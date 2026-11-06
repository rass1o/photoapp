import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureCurrentTheme, themePhase, votingOpensAt } from '../lib/themes';
import { VoteCategory, loadVoteCategories } from '../lib/voting';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import FormatTag from '../components/FormatTag';
import { loadFriendIds, onFriendsChanged } from '../lib/friends';
import { Text } from '../components/Themed';
import { CoverableImage } from '../components/ModerationCovers';
import { colors, bubbly } from '../theme';
import Wave, { WAVE_HEIGHT } from '../components/Wave';
import SandGrain from '../components/SandGrain';
import OchoLoader from '../components/OchoLoader';

type Theme = {
  id: string;
  name: string;
  end_date: string;
};

type CategoryLeader = { category: VoteCategory; submission: RankedSubmission; votes: number };

type RankedSubmission = {
  id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  vote_count: number;
  like_count: number;
  username: string;
};

type Feed = 'friends' | 'global';

// Weekly prizes for 1st -> 5th, and for each category's winner, paid by
// process_due_payouts on the server
const REWARDS = [750, 500, 300];
const CATEGORY_REWARD = 500;
const MOST_LIKED_REWARD = 200; // most likes when voting opens
const ENTRY_REWARD = 150; // for everyone who enters

const MEDALS = [
  { label: '1st', bg: '#FEF3C7', border: '#D4A017' },
  { label: '2nd', bg: '#EEF2F6', border: '#94A3B8' },
  { label: '3rd', bg: '#FCE7D6', border: '#B45309' },
];

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RankingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [feed, setFeed] = useState<Feed>('global');
  const [rankings, setRankings] = useState<RankedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<CategoryLeader[]>([]);

  const loadData = useCallback(async (selectedFeed: Feed) => {
    setErrorMessage(null);

    await ensureCurrentTheme();
    const nowIso = new Date().toISOString();
    const { data: themeData, error: themeError } = await supabase
      .from('themes')
      .select('id, name, end_date')
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (themeError) {
      setErrorMessage(themeError.message);
      return;
    }

    setTheme(themeData);

    if (!themeData) {
      setRankings([]);
      return;
    }

    let query = supabase
      .from('submissions')
      .select('id, user_id, image_url, format, vote_count, like_count')
      .eq('theme_id', themeData.id);
    if (selectedFeed === 'friends' && user) {
      query = query.in('user_id', [user.id, ...(await loadFriendIds(user.id))]);
    }
    // Ranked by likes until voting day, then by the overall votes that pay out
    const byVotes = themePhase(themeData.end_date) !== 'submit';
    const { data, error } = await query
      .order(byVotes ? 'vote_count' : 'like_count', { ascending: false })
      .order(byVotes ? 'like_count' : 'vote_count', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = data ?? [];
    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }

    const ranked = rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' }));
    setRankings(ranked);

    // Who's leading each category (ties go to whoever posted first, like the payout)
    if (selectedFeed === 'global') {
      const [categories, { data: catVotes }] = await Promise.all([
        loadVoteCategories(),
        supabase.from('category_votes').select('category, submission_id').eq('theme_id', themeData.id),
      ]);
      const byId = new Map(ranked.map((r) => [r.id, r]));
      setLeaders(
        categories.flatMap((category) => {
          const counts = new Map<string, number>();
          (catVotes ?? [])
            .filter((v) => v.category === category.id)
            .forEach((v) => counts.set(v.submission_id, (counts.get(v.submission_id) ?? 0) + 1));
          const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
          const submission = top ? byId.get(top[0]) : undefined;
          return submission ? [{ category, submission, votes: top[1] }] : [];
        })
      );
    } else {
      setLeaders([]);
    }
  }, [user]);

  // Reload whenever the tab comes into focus (new votes and submissions show
  // up without pulling to refresh) or the feed changes. Only the first load
  // of each feed shows the spinner.
  const loadedFeedRef = useRef<Feed | null>(null);
  useFocusEffect(
    useCallback(() => {
      const firstLoad = loadedFeedRef.current !== feed;
      if (firstLoad) setIsLoading(true);
      loadData(feed).finally(() => {
        loadedFeedRef.current = feed;
        setIsLoading(false);
      });
    }, [feed, loadData])
  );

  useEffect(
    () =>
      onFriendsChanged(() => {
        if (feed === 'friends') loadData('friends');
      }),
    [feed, loadData]
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData(feed);
    setIsRefreshing(false);
  };

  // Ties share a rank and skip the next one (10, 10, 7 votes -> 1, 1, 3),
  // matching how payouts place them. In Friends, ranks are among your friends.
  const phase = theme ? themePhase(theme.end_date) : 'ended';
  const byVotes = !!theme && phase !== 'submit';
  const score = (r: RankedSubmission) => (byVotes ? r.vote_count : r.like_count);
  const ranks = rankings.map((r) => 1 + rankings.filter((o) => score(o) > score(r)).length);

  const myRankIndex = rankings.findIndex((r) => r.user_id === user?.id);
  const myRanking = myRankIndex >= 0 ? rankings[myRankIndex] : null;
  const myRank = myRankIndex >= 0 ? ranks[myRankIndex] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rankings</Text>
        {theme && <Text style={styles.subtitle}>{theme.name}</Text>}
        {/* what's up for grabs, and how the list is ranked right now (both feeds) */}
        <View style={styles.prizeCard}>
          <View style={styles.medalRow}>
            {REWARDS.map((reward, i) => (
              <View key={i} style={[styles.medal, { backgroundColor: MEDALS[i].bg, borderColor: MEDALS[i].border }]}>
                <Ionicons name="trophy" size={14} color={MEDALS[i].border} />
                <Text style={styles.medalPlace}>{MEDALS[i].label}</Text>
                <View style={styles.medalAmountRow}>
                  <Ionicons name="flash" size={11} color={colors.ink} />
                  <Text style={styles.medalAmount}>{reward}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.extraRow}>
            <View style={styles.extraChip}>
              <Ionicons name="ribbon" size={13} color={colors.reef} />
              <Text style={styles.extraText}>Each category winner {CATEGORY_REWARD}</Text>
            </View>
            <View style={styles.extraChip}>
              <Ionicons name="heart" size={13} color="#dc2626" />
              <Text style={styles.extraText}>Most liked {MOST_LIKED_REWARD}</Text>
            </View>
            <View style={styles.extraChip}>
              <Ionicons name="enter" size={13} color={colors.reef} />
              <Text style={styles.extraText}>Entering {ENTRY_REWARD}</Text>
            </View>
          </View>
        </View>

        {theme && (
          <View style={[styles.phaseBanner, phase === 'vote' && styles.phaseBannerVote]}>
            <Ionicons
              name={phase === 'submit' ? 'heart' : phase === 'vote' ? 'star' : 'flag'}
              size={15}
              color={phase === 'submit' ? '#dc2626' : phase === 'vote' ? '#B45309' : colors.deep}
            />
            <Text style={styles.phaseText}>
              {phase === 'submit'
                ? `Ranked by likes until voting day, ${votingOpensAt(theme.end_date).toLocaleDateString(undefined, { weekday: 'long' })}`
                : phase === 'vote'
                  ? 'Voting day! Ranked by overall votes'
                  : 'Final results'}
            </Text>
          </View>
        )}
        {feed === 'friends' && <Text style={styles.friendsNote}>Ranks here are among you and your friends</Text>}

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, feed === 'friends' && styles.toggleActive]}
            onPress={() => setFeed('friends')}
          >
            <Text style={feed === 'friends' ? styles.toggleTextActive : styles.toggleText}>
              Friends
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, feed === 'global' && styles.toggleActive]}
            onPress={() => setFeed('global')}
          >
            <Text style={feed === 'global' ? styles.toggleTextActive : styles.toggleText}>
              Global
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <SandGrain />
        <Wave />

        {isLoading ? (
          <View style={styles.centered}>
            <OchoLoader message="Ocho is counting the votes…" />
          </View>
        ) : errorMessage ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={rankings}
            contentContainerStyle={{ paddingTop: WAVE_HEIGHT + 4 }}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              leaders.length > 0 ? (
                <View style={styles.leaders}>
                  <Text style={styles.leadersTitle}>Category leaders</Text>
                  {leaders.map((l) => (
                    <Pressable
                      key={l.category.id}
                      style={styles.leaderRow}
                      onPress={() => navigation.push('SubmissionDetail', { submissionId: l.submission.id })}
                    >
                      <Ionicons name={l.category.icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.reef} />
                      <Text style={styles.leaderCategory} numberOfLines={1}>{l.category.label}</Text>
                      <CoverableImage uri={l.submission.image_url} id={l.submission.id} ownerId={l.submission.user_id} style={styles.leaderThumb} tiny />
                      <Text style={styles.leaderName} numberOfLines={1}>
                        {l.submission.user_id === user?.id ? 'You' : l.submission.username}
                      </Text>
                      <Text style={styles.leaderVotes}>{l.votes}</Text>
                    </Pressable>
                  ))}
                  <Text style={[styles.leadersTitle, { marginTop: 14 }]}>Overall</Text>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>
                  {feed === 'friends'
                    ? 'No submissions from you or your friends yet. It\'s quiet under the sea.'
                    : 'No submissions yet. It\'s quiet under the sea.'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMe = item.user_id === user?.id;
              const rank = ranks[index];
              // Prize spots only highlight in Global, since payouts are global
              const isPrize = feed === 'global' && byVotes && rank <= REWARDS.length && item.vote_count > 0;
              const isTie = ranks.filter((r) => r === rank).length > 1;
              return (
                <View style={[styles.row, isMe && styles.rowMe]}>
                  <Text style={[styles.rank, isPrize && styles.rankTop]}>
                    {isTie ? 'T' : ''}
                    {rank}
                  </Text>
                  <Pressable onPress={() => navigation.push('SubmissionDetail', { submissionId: item.id })}>
                    <CoverableImage uri={item.image_url} id={item.id} ownerId={item.user_id} style={styles.thumb} tiny />
                  </Pressable>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => navigation.push('UserProfile', { userId: item.user_id })}
                  >
                    <View style={styles.nameRow}>
                      <Text style={styles.username} numberOfLines={1}>
                        {isMe ? 'You' : item.username}
                      </Text>
                      <FormatTag format={item.format} />
                    </View>
                    {isPrize && <Text style={styles.rewardText}>+{REWARDS[rank - 1]} shutters</Text>}
                  </Pressable>
                  <View style={styles.scores}>
                    <Text style={[styles.votes, !byVotes && styles.scoreMain]}>{'\u2665'} {item.like_count}</Text>
                    {byVotes && <Text style={[styles.votes, styles.scoreMain]}>{'\u2605'} {item.vote_count}</Text>}
                  </View>
                </View>
              );
            }}
          />
        )}

        {myRanking && myRank !== null && myRank > REWARDS.length && (
          <View style={styles.pinnedRow}>
            <Text style={styles.pinnedRank}>#{myRank}</Text>
            <CoverableImage uri={myRanking.image_url} id={myRanking.id} ownerId={myRanking.user_id} style={styles.thumb} tiny />
            <Text style={styles.pinnedUsername}>You</Text>
            <Text style={styles.pinnedVotes}>{byVotes ? `${myRanking.vote_count} votes` : `${myRanking.like_count} likes`}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sea },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  sheet: { flex: 1, backgroundColor: colors.shell, paddingHorizontal: 16 },
  title: { ...bubbly, fontSize: 28 },
  subtitle: { fontSize: 13, color: colors.muted },
  prizeCard: {
    backgroundColor: colors.shell,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    padding: 10,
    marginTop: 10,
  },
  medalRow: { flexDirection: 'row', gap: 8 },
  medal: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 2, paddingVertical: 6 },
  medalPlace: { fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 1 },
  medalAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  medalAmount: { ...bubbly, fontSize: 18, textShadowOffset: { width: 0, height: 1 } },
  extraRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  extraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.reefLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  extraText: { fontSize: 12, fontWeight: '600', color: colors.reefDark },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
  },
  phaseBannerVote: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#F59E0B' },
  phaseText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  friendsNote: { fontSize: 12, color: colors.reefDark, textAlign: 'center', marginTop: 6 },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.sandTrack,
    borderRadius: 20,
    padding: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 18 },
  toggleActive: { backgroundColor: colors.shell },
  toggleText: { color: colors.muted, fontSize: 13 },
  toggleTextActive: { fontWeight: '600', fontSize: 13, color: colors.deep },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 30 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  emptyText: { color: colors.faint, fontSize: 13, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.sand,
  },
  // The highlight reaches past the row's edges so your rank, photo and name
  // stay lined up with everyone else's
  rowMe: { backgroundColor: colors.reefLight, borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8 },
  rank: { width: 28, fontWeight: '600', color: colors.muted, fontSize: 14 },
  rankTop: { color: '#b45309' },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.sand },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: 14, flexShrink: 1 },
  rewardText: { fontSize: 11, color: '#b45309', marginTop: 2 },
  votes: { fontSize: 13, color: colors.muted },
  scores: { alignItems: 'flex-end', gap: 1 },
  scoreMain: { color: colors.ink, fontWeight: '600' },
  leaders: { marginBottom: 6 },
  leadersTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.ink, textTransform: 'uppercase', marginBottom: 6 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.sand },
  leaderCategory: { width: 120, fontSize: 13, fontWeight: '600', color: colors.ink },
  leaderThumb: { width: 30, height: 30, borderRadius: 5, backgroundColor: colors.sand },
  leaderName: { flex: 1, fontSize: 13, color: colors.text },
  leaderVotes: { fontSize: 13, fontWeight: '600', color: colors.reef },

  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
    padding: 10,
    backgroundColor: colors.reefLight,
    borderRadius: 8,
  },
  pinnedRank: { width: 30, fontWeight: '600', color: colors.reef, fontSize: 14 },
  pinnedUsername: { flex: 1, fontSize: 14, color: colors.reef, fontWeight: '500' },
  pinnedVotes: { fontSize: 13, color: colors.reef },
});
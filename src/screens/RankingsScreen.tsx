import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import FormatTag from '../components/FormatTag';
import { loadFriendIds, onFriendsChanged } from '../lib/friends';
import { Text } from '../components/Themed';
import { colors, bubbly } from '../theme';
import Wave from '../components/Wave';
import SandGrain from '../components/SandGrain';
import SeaLife from '../components/SeaLife';

type Theme = {
  id: string;
  name: string;
};

type RankedSubmission = {
  id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  vote_count: number;
  username: string;
};

type Feed = 'friends' | 'global';

// Weekly prizes for 1st -> 5th, paid by process_due_payouts on the server
const REWARDS = [50, 40, 30, 20, 15];

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

  const loadData = useCallback(async (selectedFeed: Feed) => {
    setErrorMessage(null);

    const nowIso = new Date().toISOString();
    const { data: themeData, error: themeError } = await supabase
      .from('themes')
      .select('id, name')
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
      .select('id, user_id, image_url, format, vote_count')
      .eq('theme_id', themeData.id);
    if (selectedFeed === 'friends' && user) {
      query = query.in('user_id', [user.id, ...(await loadFriendIds(user.id))]);
    }
    const { data, error } = await query.order('vote_count', { ascending: false });

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

    setRankings(rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' })));
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
  const ranks = rankings.map((r) => 1 + rankings.filter((o) => o.vote_count > r.vote_count).length);

  const myRankIndex = rankings.findIndex((r) => r.user_id === user?.id);
  const myRanking = myRankIndex >= 0 ? rankings[myRankIndex] : null;
  const myRank = myRankIndex >= 0 ? ranks[myRankIndex] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SeaLife />
      <View style={styles.header}>
        <Text style={styles.title}>Rankings</Text>
        {theme && <Text style={styles.subtitle}>{theme.name}</Text>}
        <Text style={styles.prizeHint}>
          {feed === 'global'
            ? `Top 5 overall win ${REWARDS.join(' · ')} shutters`
            : 'How you stack up against your friends'}
        </Text>

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
            <ActivityIndicator color={colors.deep} />
          </View>
        ) : errorMessage ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={rankings}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
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
              const isPrize = feed === 'global' && rank <= REWARDS.length && item.vote_count > 0;
              const isTie = ranks.filter((r) => r === rank).length > 1;
              return (
                <View style={[styles.row, isMe && styles.rowMe]}>
                  <Text style={[styles.rank, isPrize && styles.rankTop]}>
                    {isTie ? 'T' : ''}
                    {rank}
                  </Text>
                  <Pressable onPress={() => navigation.push('SubmissionDetail', { submissionId: item.id })}>
                    <Image source={{ uri: item.image_url }} style={styles.thumb} />
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
                  <Text style={styles.votes}>{item.vote_count} votes</Text>
                </View>
              );
            }}
          />
        )}

        {myRanking && myRank !== null && myRank > REWARDS.length && (
          <View style={styles.pinnedRow}>
            <Text style={styles.pinnedRank}>#{myRank}</Text>
            <Image source={{ uri: myRanking.image_url }} style={styles.thumb} />
            <Text style={styles.pinnedUsername}>You</Text>
            <Text style={styles.pinnedVotes}>{myRanking.vote_count} votes</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sea },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  sheet: { flex: 1, backgroundColor: colors.shell, paddingHorizontal: 16, paddingTop: 6 },
  title: { ...bubbly, fontSize: 28 },
  subtitle: { fontSize: 13, color: colors.muted },
  prizeHint: { fontSize: 12, color: colors.reefDark, fontWeight: '500', marginTop: 2, marginBottom: 12 },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.sandTrack,
    borderRadius: 20,
    padding: 3,
    marginBottom: 24, // room for the wave below
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
  rowMe: { backgroundColor: colors.reefLight, borderRadius: 8, paddingHorizontal: 8 },
  rank: { width: 28, fontWeight: '600', color: colors.muted, fontSize: 14 },
  rankTop: { color: '#b45309' },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.sand },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: 14, flexShrink: 1 },
  rewardText: { fontSize: 11, color: '#b45309', marginTop: 2 },
  votes: { fontSize: 13, color: colors.muted },

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
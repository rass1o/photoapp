import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import FormatTag from '../components/FormatTag';
import { loadFriendIds, onFriendsChanged } from '../lib/friends';

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

  useEffect(() => {
    setIsLoading(true);
    loadData(feed).finally(() => setIsLoading(false));
  }, [feed, loadData]);

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0B1418" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#6b7280' },
  prizeHint: { fontSize: 12, color: '#b45309', fontWeight: '500', marginTop: 2, marginBottom: 12 },

  toggleRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 12,
  },
  toggle: { flex: 1, padding: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#f3f4f6' },
  toggleText: { color: '#6b7280', fontSize: 13 },
  toggleTextActive: { fontWeight: '600', fontSize: 13 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 30 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  rowMe: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 8 },
  rank: { width: 28, fontWeight: '600', color: '#6b7280', fontSize: 14 },
  rankTop: { color: '#b45309' },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#f3f4f6' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: 14, flexShrink: 1 },
  rewardText: { fontSize: 11, color: '#b45309', marginTop: 2 },
  votes: { fontSize: 13, color: '#6b7280' },

  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
  },
  pinnedRank: { width: 30, fontWeight: '600', color: '#4f46e5', fontSize: 14 },
  pinnedUsername: { flex: 1, fontSize: 14, color: '#4f46e5', fontWeight: '500' },
  pinnedVotes: { fontSize: 13, color: '#4f46e5' },
});
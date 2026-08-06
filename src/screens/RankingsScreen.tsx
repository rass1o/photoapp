import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Theme = {
  id: string;
  name: string;
};

type RankedSubmission = {
  id: string;
  user_id: string;
  image_url: string;
  vote_count: number;
  username: string;
};

export default function RankingsScreen() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [rankings, setRankings] = useState<RankedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (selectedFormat: 'digital' | 'film') => {
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

    const { data, error } = await supabase
      .from('submissions')
      .select('id, user_id, image_url, vote_count')
      .eq('theme_id', themeData.id)
      .eq('format', selectedFormat)
      .order('vote_count', { ascending: false });

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
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadData(format).finally(() => setIsLoading(false));
  }, [format, loadData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData(format);
    setIsRefreshing(false);
  };

  const myRankIndex = rankings.findIndex((r) => r.user_id === user?.id);
  const myRanking = myRankIndex >= 0 ? rankings[myRankIndex] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Rankings</Text>
      {theme && <Text style={styles.subtitle}>{theme.name}</Text>}

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, format === 'digital' && styles.toggleActive]}
          onPress={() => setFormat('digital')}
        >
          <Text style={format === 'digital' ? styles.toggleTextActive : styles.toggleText}>
            Digital
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, format === 'film' && styles.toggleActive]}
          onPress={() => setFormat('film')}
        >
          <Text style={format === 'film' ? styles.toggleTextActive : styles.toggleText}>
            Film
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
              <Text style={styles.emptyText}>No {format} submissions yet for this theme.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMe = item.user_id === user?.id;
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={[styles.rank, index < 3 && styles.rankTop]}>{index + 1}</Text>
                <Image source={{ uri: item.image_url }} style={styles.thumb} />
                <Text style={styles.username}>{isMe ? 'You' : item.username}</Text>
                <Text style={styles.votes}>{item.vote_count} votes</Text>
              </View>
            );
          }}
        />
      )}

      {myRanking && myRankIndex >= 3 && (
        <View style={styles.pinnedRow}>
          <Text style={styles.pinnedRank}>#{myRankIndex + 1}</Text>
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
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 12 },

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
  rank: { width: 22, fontWeight: '600', color: '#6b7280', fontSize: 14 },
  rankTop: { color: '#b45309' },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#f3f4f6' },
  username: { flex: 1, fontSize: 14 },
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
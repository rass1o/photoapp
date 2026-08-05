import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Theme = {
  id: string;
  name: string;
  end_date: string;
};

type Submission = {
  id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  vote_count: number;
  created_at: string;
};

function formatCountdown(endDate: string): string {
  const msLeft = new Date(endDate).getTime() - Date.now();
  if (msLeft <= 0) return 'Voting closed';
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  return `Voting ends in ${days}d ${hours}h`;
}

export default function HomeScreen() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (selectedFormat: 'digital' | 'film') => {
    setErrorMessage(null);

    // Find the theme whose date range covers right now
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
      setSubmissions([]);
      return;
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, user_id, image_url, format, vote_count, created_at')
      .eq('theme_id', themeData.id)
      .eq('format', selectedFormat)
      .order('created_at', { ascending: false });

    if (submissionsError) {
      setErrorMessage(submissionsError.message);
      return;
    }

    setSubmissions(submissionsData ?? []);
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.appName}>Frames</Text>
        <View style={styles.topBarIcons}>
          <Ionicons name="search-outline" size={20} color="#1A2A32" />
          <Ionicons name="notifications-outline" size={20} color="#1A2A32" style={{ marginLeft: 10 }} />
        </View>
      </View>

      <View style={styles.themeBanner}>
        <Text style={styles.themeLabel}>THIS WEEK'S THEME</Text>
        <Text style={styles.themeName}>{theme?.name ?? 'No active theme'}</Text>
        {theme && <Text style={styles.themeCountdown}>{formatCountdown(theme.end_date)}</Text>}
      </View>

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
          style={styles.feedSheet}
          data={submissions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                No {format} submissions yet for this theme. Be the first!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar} />
                {/* TODO: replace with real username once a public profiles table exists */}
                <Text style={styles.username}>user_{item.user_id.slice(0, 6)}</Text>
                <Ionicons name="ellipsis-horizontal" size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
              </View>

              <Image source={{ uri: item.image_url }} style={styles.image} />

              <View style={styles.actionsRow}>
                <View style={styles.actionItem}>
                  <Ionicons name="heart-outline" size={18} color="#4b5563" />
                  <Text style={styles.actionText}>{item.vote_count}</Text>
                </View>
                <View style={styles.actionItem}>
                  <Ionicons name="chatbubble-outline" size={17} color="#4b5563" />
                  <Text style={styles.actionText}>0</Text>
                </View>
                <Ionicons name="share-outline" size={18} color="#4b5563" style={{ marginLeft: 'auto' }} />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#D9E2E6' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  appName: { fontSize: 17, fontWeight: '600', color: '#1A2A32' },
  topBarIcons: { flexDirection: 'row', alignItems: 'center' },

  themeBanner: { alignItems: 'center', paddingVertical: 16 },
  themeLabel: { fontSize: 11, color: '#46606B', letterSpacing: 0.5, marginBottom: 4 },
  themeName: { fontSize: 26, fontWeight: '700', color: '#0B1418' },
  themeCountdown: { fontSize: 12, color: '#46606B', marginTop: 6 },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    padding: 2,
  },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleActive: { backgroundColor: '#ffffff' },
  toggleText: { fontSize: 13, color: '#46606B' },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: '#0B1418' },

  feedSheet: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 4,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 30 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },

  card: { paddingHorizontal: 16, paddingTop: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#dbeafe' },
  username: { fontSize: 14, fontWeight: '600', color: '#111827' },
  image: { width: '100%', height: 320, borderRadius: 10, backgroundColor: '#f3f4f6' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: '#4b5563' },
});
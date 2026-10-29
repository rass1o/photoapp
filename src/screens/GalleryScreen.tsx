import { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import BackBar from '../components/BackBar';
import SandGrain from '../components/SandGrain';
import { Text } from '../components/Themed';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

type Filter = 'all' | 'film' | 'digital';

type GalleryItem = {
  id: string;
  image_url: string;
  format: 'digital' | 'film';
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'film', label: 'Film' },
  { id: 'digital', label: 'Digital' },
];

// Everything someone has submitted, newest first. Profiles only preview the
// latest few and link here, so they stay short however much you post.
export default function GalleryScreen({ route, navigation }: Props) {
  const { userId, username } = route.params;
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('submissions')
      .select('id, image_url, format')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as GalleryItem[]);
        setIsLoading(false);
      });
  }, [userId]);

  const shown = filter === 'all' ? items : items.filter((i) => i.format === filter);

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <SandGrain />
      <BackBar title={`${username}’s gallery`} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? items.length : items.filter((i) => i.format === f.id).length;
          const active = filter === f.id;
          return (
            <Pressable key={f.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.id)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} · {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.deep} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(g) => g.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 6 }}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={<Text style={styles.emptyText}>No {filter === 'all' ? '' : `${filter} `}photos yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.tile}
              onPress={() => navigation.push('SubmissionDetail', { submissionId: item.id })}
            >
              <Image source={{ uri: item.image_url }} style={styles.image} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.shell },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.sandBorder,
  },
  chipActive: { backgroundColor: colors.deep, borderColor: colors.deep },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  grid: { paddingHorizontal: 16, paddingBottom: 24, gap: 6 },
  tile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.sand },
  image: { width: '100%', height: '100%' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
});

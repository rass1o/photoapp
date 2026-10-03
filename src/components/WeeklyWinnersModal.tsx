import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, Pressable, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Winner = {
  place: 1 | 2 | 3;
  username: string;
  imageUrl: string;
  voteCount: number;
  reward: number;
};

type Props = {
  visible: boolean;
  themeName: string;
  winners: Winner[]; // must be ordered [3rd, 2nd, 1st] so the swipe builds up to the win
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PLACE_LABELS: Record<number, string> = { 1: '1st place', 2: '2nd place', 3: '3rd place' };
const PLACE_COLORS: Record<number, string> = { 1: '#f59e0b', 2: '#9ca3af', 3: '#b45309' };

export default function WeeklyWinnersModal({ visible, themeName, winners, onClose }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPageIndex(index);
  };

  const isLastPage = pageIndex === winners.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Results are in</Text>
          <Text style={styles.headerSubtitle}>"{themeName}"</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {winners.map((w) => (
            <View key={w.place} style={[styles.page, { width: SCREEN_WIDTH }]}>
              <View style={[styles.placeBadge, { backgroundColor: PLACE_COLORS[w.place] }]}>
                <Text style={styles.placeBadgeText}>{PLACE_LABELS[w.place]}</Text>
              </View>

              <Image source={{ uri: w.imageUrl }} style={styles.image} resizeMode="contain" />

              <Text style={styles.username}>{w.username}</Text>
              <Text style={styles.voteCount}>{w.voteCount} votes</Text>

              <View style={styles.rewardPill}>
                <Ionicons name="flash" size={14} color="#92400e" />
                <Text style={styles.rewardText}>+{w.reward} shutters</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {winners.map((w, i) => (
              <View key={w.place} style={[styles.dot, i === pageIndex && styles.dotActive]} />
            ))}
          </View>

          {isLastPage ? (
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Nice!</Text>
            </Pressable>
          ) : (
            <Text style={styles.swipeHint}>Swipe to see the next winner</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1418' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  placeBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16 },
  placeBadgeText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  image: { width: '100%', height: 340, borderRadius: 14, backgroundColor: '#1f2937' },
  username: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginTop: 16 },
  voteCount: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  rewardText: { fontSize: 13, fontWeight: '600', color: '#92400e' },
  footer: { alignItems: 'center', paddingBottom: 40, paddingTop: 10 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#374151' },
  dotActive: { backgroundColor: '#ffffff', width: 18 },
  swipeHint: { fontSize: 12, color: '#6b7280' },
  closeButton: { backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 28, paddingVertical: 12 },
  closeButtonText: { fontSize: 14, fontWeight: '700', color: '#0B1418' },
});
import { useState } from 'react';
import { View, StyleSheet, Modal, Image, Pressable, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors, bubbly } from '../theme';

export type Winner = {
  submissionId: string;
  place: 1 | 2 | 3 | 4 | 5;
  format: 'digital' | 'film';
  isTie: boolean; // shares this place with another photo
  username: string;
  imageUrl: string;
  voteCount: number;
  reward: number;
};

type Props = {
  visible: boolean;
  themeName: string;
  winners: Winner[]; // ordered 5th -> 1st so the swipe builds up to the win
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PLACE_LABELS: Record<number, string> = {
  1: '1st place',
  2: '2nd place',
  3: '3rd place',
  4: '4th place',
  5: '5th place',
};
const FORMAT_LABELS: Record<Winner['format'], string> = { digital: 'Digital', film: 'Film' };
const PLACE_COLORS: Record<number, string> = {
  1: '#f59e0b',
  2: colors.faint,
  3: '#b45309',
  4: '#7dd3fc',
  5: '#a5b4fc',
};

export default function WeeklyWinnersModal({ visible, themeName, winners, onClose }: Props) {
  const [pageIndex, setPageIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPageIndex(index);
  };

  const isLastPage = pageIndex === winners.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeIcon} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.faint} />
          </Pressable>
          <Text style={styles.headerTitle}>Results are in</Text>
          <Text style={styles.headerSubtitle}>"{themeName}"</Text>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {winners.map((w) => (
            <View key={w.submissionId} style={[styles.page, { width: SCREEN_WIDTH }]}>
              <View style={[styles.placeBadge, { backgroundColor: PLACE_COLORS[w.place] }]}>
                <Text style={styles.placeBadgeText}>
                  {w.isTie ? 'Tied for ' : ''}
                  {PLACE_LABELS[w.place]} · {FORMAT_LABELS[w.format]}
                </Text>
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
              <View key={w.submissionId} style={[styles.dot, i === pageIndex && styles.dotActive]} />
            ))}
          </View>

          {isLastPage ? (
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Ink-credible!</Text>
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
  container: { flex: 1, backgroundColor: colors.deep },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 10 },
  closeIcon: { position: 'absolute', top: 56, right: 20 },
  headerTitle: { ...bubbly, fontSize: 28, color: colors.white, textShadowColor: colors.reef },
  headerSubtitle: { fontSize: 13, color: colors.faint, marginTop: 4 },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  placeBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16 },
  placeBadgeText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  image: { width: '100%', height: 340, borderRadius: 14, backgroundColor: colors.abyss },
  username: { fontSize: 18, fontWeight: '700', color: colors.white, marginTop: 16 },
  voteCount: { fontSize: 13, color: colors.faint, marginTop: 2 },
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
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text },
  dotActive: { backgroundColor: colors.shell, width: 18 },
  swipeHint: { fontSize: 12, color: colors.muted },
  closeButton: { backgroundColor: colors.shell, borderRadius: 8, paddingHorizontal: 28, paddingVertical: 12 },
  closeButtonText: { fontSize: 14, fontWeight: '700', color: colors.deep },
});
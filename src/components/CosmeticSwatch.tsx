import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileCategory } from '../lib/shop';
import { colors } from '../theme';
import FrameDecoration, { frameColor } from './AvatarFrame';
import BannerArt, { bannerColor } from './BannerArt';

// Small preview of a profile cosmetic, used by the Shop and the Profile locker
export default function CosmeticSwatch({ category, value }: { category: ProfileCategory; value: string }) {
  if (category === 'frame') {
    return (
      <View style={styles.frameBox}>
        <View style={[styles.frame, { borderColor: frameColor(value) }]} />
        <FrameDecoration value={value} size={36} />
      </View>
    );
  }
  if (category === 'banner') {
    return (
      <View style={[styles.banner, { backgroundColor: bannerColor(value) }]}>
        <BannerArt value={value} />
      </View>
    );
  }
  return (
    <View style={styles.badge}>
      <Ionicons name={value as keyof typeof Ionicons.glyphMap} size={18} color="#92400e" />
    </View>
  );
}

const styles = StyleSheet.create({
  // room around the circle for decorations that stick out
  frameBox: { width: 36, height: 36, marginVertical: 6 },
  frame: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, backgroundColor: colors.coralLight },
  banner: { width: '100%', height: 40, borderRadius: 6, borderWidth: 1, borderColor: colors.sandBorder, overflow: 'hidden' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

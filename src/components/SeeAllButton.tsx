import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

// Profiles preview this many photos; the rest live on the Gallery screen
export const GALLERY_PREVIEW = 6;

export default function SeeAllButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>See all {count} photos</Text>
      <Ionicons name="chevron-forward" size={15} color={colors.reef} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.reefBorder,
    backgroundColor: colors.reefLight,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.reef },
});

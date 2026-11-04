import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // Pass both to make the section fold: tap the header to open or close it
  open?: boolean;
  onToggle?: () => void;
};

// Shared section header used across Profile, public Profile, and Camera —
// bold uppercase label with a full-width rule, so each section reads as
// its own distinct block rather than a floating word with whitespace.
export default function SectionHeader({ icon, label, open, onToggle }: Props) {
  const content = (
    <>
      <Ionicons name={icon} size={15} color={colors.ink} />
      <Text style={styles.label}>{label}</Text>
      {onToggle && (
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink} style={styles.chevron} />
      )}
    </>
  );

  if (!onToggle) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !open && styles.rowClosed, pressed && styles.pressed]}
      onPress={onToggle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    marginBottom: 10,
    marginTop: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  // closed sections sit a little tighter so a column of them reads as a list
  rowClosed: { marginBottom: 14 },
  pressed: { opacity: 0.6 },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    textTransform: 'uppercase',
  },
  chevron: { marginLeft: 'auto' },
});

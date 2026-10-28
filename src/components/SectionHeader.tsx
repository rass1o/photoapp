import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

// Shared section header used across Profile, public Profile, and Camera —
// bold uppercase label with a full-width rule, so each section reads as
// its own distinct block rather than a floating word with whitespace.
export default function SectionHeader({ icon, label }: Props) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={colors.ink} />
      <Text style={styles.label}>{label}</Text>
    </View>
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    textTransform: 'uppercase',
  },
});
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

// Small pill next to a username saying how the photo was shot
export default function FormatTag({ format }: { format: 'digital' | 'film' }) {
  const film = format === 'film';
  return (
    <View style={[styles.tag, film && styles.tagFilm]}>
      <Ionicons name={film ? 'film-outline' : 'camera-outline'} size={11} color={film ? '#92400e' : colors.reefDark} />
      <Text style={[styles.text, film && styles.textFilm]}>{film ? 'Film' : 'Digital'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.reefLight,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagFilm: { backgroundColor: '#fef3c7' },
  text: { fontSize: 10, fontWeight: '600', color: colors.reefDark },
  textFilm: { color: '#92400e' },
});

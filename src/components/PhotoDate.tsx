import { StyleSheet, View } from 'react-native';
import Stamp from './Stamp';

// When a photo was posted, printed in the bottom corner the way a film camera
// dates its prints: 11 23 '26  4:05PM

export function formatPhotoDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const suffix = d.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(d.getMonth() + 1)} ${pad(d.getDate())} '${String(d.getFullYear()).slice(2)}  ${hours}:${pad(d.getMinutes())}${suffix}`;
}

type Props = {
  date: string;
  // inside a film strip frame, so it sits above the strip's bottom edge
  film?: boolean;
};

export default function PhotoDate({ date, film }: Props) {
  return (
    <View style={[styles.wrap, film && styles.wrapFilm]} pointerEvents="none">
      <Stamp style={styles.text}>{formatPhotoDate(date)}</Stamp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 10, bottom: 10 },
  wrapFilm: { right: 14, bottom: 25 },
  // a dark glow so it reads on bright photos too
  text: { fontSize: 12, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 3 },
});

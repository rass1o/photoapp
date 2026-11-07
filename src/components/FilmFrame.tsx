import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Stamp from './Stamp';

// Photos tagged Film sit in a strip of 35mm film: a dark border with
// sprocket holes along the top and bottom and a frame number in the edge.
// Digital photos pass straight through.

const HOLES = Array.from({ length: 28 }, (_, i) => i);

export default function FilmFrame({ film, frame, children }: { film: boolean; frame?: string; children: ReactNode }) {
  if (!film) return <>{children}</>;
  return (
    <View style={styles.strip}>
      <View style={[styles.holes, styles.top]} pointerEvents="none">
        {HOLES.map((i) => (
          <View key={i} style={styles.hole} />
        ))}
      </View>
      <View style={styles.photo}>{children}</View>
      <View style={[styles.holes, styles.bottom]} pointerEvents="none">
        {HOLES.map((i) => (
          <View key={i} style={styles.hole} />
        ))}
      </View>
      {frame ? (
        <Stamp style={styles.edge} numberOfLines={1}>
          {frame}
        </Stamp>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: '#17130F', borderRadius: 5, paddingVertical: 15, paddingHorizontal: 4, overflow: 'hidden' },
  photo: { borderRadius: 2, overflow: 'hidden' },
  holes: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', overflow: 'hidden' },
  top: { top: 4 },
  bottom: { bottom: 4 },
  hole: { width: 7, height: 6, borderRadius: 1.5, backgroundColor: '#E9E2D6', opacity: 0.85 },
  edge: { position: 'absolute', right: 10, bottom: 0, fontSize: 9, letterSpacing: 1, color: '#F2994A', backgroundColor: '#17130F', paddingHorizontal: 3 },
});

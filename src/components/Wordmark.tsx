import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Text } from './Themed';
import { colors, bubbly } from '../theme';

// The ShuttInk title: the S is one of Ocho's tentacles, and the word sits on
// a strip of film unrolling from a reel.

const FILM = colors.ink;
const TENTACLE = '#a78bfa'; // Ocho's starting lilac
const OUTLINE = colors.abyss;

const S_MAIN = 'M47,15 C43,5 24,3 16,10 C7,18 13,31 28,37 C43,43 52,52 46,64 C40,74 22,76 13,67';
const S_TIP = 'M13,67 C8,62 10,55 16,57 C19,58 19,62 16,62'; // the curled tip, thinner
const SUCKERS = [
  [31, 6],
  [14, 20],
  [24, 34],
  [40, 42],
  [47, 57],
  [34, 71],
];

function TentacleS({ size }: { size: number }) {
  return (
    <Svg width={size * 0.66} height={size * 0.88} viewBox="0 0 60 80" style={{ marginRight: size * 0.02 }}>
      <Path d={S_MAIN} stroke={OUTLINE} strokeWidth={15} strokeLinecap="round" fill="none" />
      <Path d={S_TIP} stroke={OUTLINE} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Path d={S_MAIN} stroke={TENTACLE} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Path d={S_TIP} stroke={TENTACLE} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      {SUCKERS.map(([x, y]) => (
        <Circle key={`${x},${y}`} cx={x} cy={y} r={2.3} fill="#F5D0FE" stroke={OUTLINE} strokeWidth={0.8} />
      ))}
    </Svg>
  );
}

function Reel({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} fill="#2B3A4F" stroke={OUTLINE} strokeWidth={5} />
      <Circle cx={50} cy={50} r={36} fill="none" stroke="#3E5068" strokeWidth={3} />
      {[0, 72, 144, 216, 288].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        return <Circle key={deg} cx={50 + 24 * Math.cos(a)} cy={50 + 24 * Math.sin(a)} r={10} fill={colors.sea} />;
      })}
      <Circle cx={50} cy={50} r={8} fill="#CBD5E1" stroke={OUTLINE} strokeWidth={3} />
    </Svg>
  );
}

// size is the letter size; the film is about 1.6x that tall
export default function Wordmark({ size = 34 }: { size?: number }) {
  const [width, setWidth] = useState(0);
  const height = size * 1.6;
  const reel = height * 1.12;
  const hole = { w: size * 0.26, h: size * 0.17, gap: size * 0.2, edge: size * 0.11 };
  const count = Math.max(0, Math.floor((width - hole.gap) / (hole.w + hole.gap)));
  const start = (width - (count * hole.w + (count - 1) * hole.gap)) / 2;

  return (
    <View style={[styles.wrap, { paddingLeft: reel * 0.62 }]} accessible accessibilityLabel="ShuttInk">
      <View
        style={[styles.film, { height, paddingLeft: reel * 0.48, paddingRight: size * 0.4 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
            <Rect x={0} y={0} width={width} height={height} rx={size * 0.12} fill={FILM} />
            {Array.from({ length: count }, (_, i) => (
              <Rect
                key={i}
                x={start + i * (hole.w + hole.gap)}
                y={hole.edge}
                width={hole.w}
                height={hole.h}
                rx={hole.h * 0.3}
                fill={colors.sea}
              />
            ))}
            {Array.from({ length: count }, (_, i) => (
              <Rect
                key={`b${i}`}
                x={start + i * (hole.w + hole.gap)}
                y={height - hole.edge - hole.h}
                width={hole.w}
                height={hole.h}
                rx={hole.h * 0.3}
                fill={colors.sea}
              />
            ))}
          </Svg>
        )}
        <TentacleS size={size} />
        <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.15 }]}>huttInk</Text>
      </View>
      {/* drawn last so it sits on top of the end of the film */}
      <View style={[styles.reel, { top: (height - reel) / 2 }]}>
        <Reel size={reel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  film: { flexDirection: 'row', alignItems: 'center' },
  word: { ...bubbly, color: colors.white, textShadowColor: colors.reef, includeFontPadding: false },
  reel: { position: 'absolute', left: 0 },
});

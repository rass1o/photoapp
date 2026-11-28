import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Text } from './Themed';
import { colors, bubbly } from '../theme';

// The ShuttInk title: the S is one of Ocho's tentacles, and the word sits on
// a strip of film pulled out of a 35mm film canister, seen from the side,
// with Ocho on its label like a film brand's logo. Fixed colors, so the logo
// looks the same in light and dark mode.

const FILM = '#14212B';
const TENTACLE = '#a78bfa'; // Ocho's starting lilac
const OUTLINE = '#14507A';

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

// Drawn in a 50 x 92 box: the spool's end on top, ridged metal caps, the
// dark body with a label wrapped round it, and the felt slot on the right
// that the film comes out of
const CANISTER_W = 50;
const CANISTER_H = 92;

function Canister({ height }: { height: number }) {
  return (
    <Svg width={(height * CANISTER_W) / CANISTER_H} height={height} viewBox={`0 0 ${CANISTER_W} ${CANISTER_H}`}>
      <G transform="translate(2,3)" stroke={OUTLINE} strokeWidth={2}>
        <Rect x={17} y={0} width={12} height={8} rx={2} fill="#CBD5E1" />
        <Rect x={2} y={6} width={42} height={9} rx={3} fill="#9FB0C2" />
        <Rect x={5} y={14} width={36} height={64} fill="#2B3A4F" />
        <Rect x={2} y={77} width={42} height={9} rx={3} fill="#9FB0C2" />
        {/* ridges on the caps */}
        {[10, 16, 22, 28, 34].map((x) => (
          <Path key={x} d={`M${x},8 V13 M${x},79 V84`} stroke="#7C8DA0" strokeWidth={1.2} />
        ))}
        <Rect x={40} y={20} width={6} height={52} rx={2} fill={FILM} />
        {/* the label, with Ocho as the brand */}
        <Rect x={5} y={26} width={36} height={40} fill="#FAF6EF" strokeWidth={0} />
        <Rect x={5} y={26} width={36} height={4} fill="#E8664A" strokeWidth={0} />
        <Rect x={5} y={62} width={36} height={4} fill="#E8664A" strokeWidth={0} />
        <Path
          d="M16,52 C14,58 11,59 10,62 M20,53 C20,58 18,60 18,63 M26,53 C26,58 28,60 28,63 M30,52 C32,58 35,59 36,62"
          fill="none"
          stroke={TENTACLE}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Ellipse cx={23} cy={45} rx={9} ry={8.5} fill={TENTACLE} strokeWidth={1.5} />
        <Circle cx={19.5} cy={45} r={2.2} fill="#FFFFFF" strokeWidth={0} />
        <Circle cx={26.5} cy={45} r={2.2} fill="#FFFFFF" strokeWidth={0} />
        <Circle cx={20} cy={45.4} r={1.1} fill={FILM} strokeWidth={0} />
        <Circle cx={27} cy={45.4} r={1.1} fill={FILM} strokeWidth={0} />
        {/* a shine down the metal */}
        <Rect x={8} y={16} width={3} height={60} fill="#FFFFFF" opacity={0.15} strokeWidth={0} />
      </G>
    </Svg>
  );
}

// size is the letter size; the film is about 1.6x that tall
export default function Wordmark({ size = 34 }: { size?: number }) {
  const [width, setWidth] = useState(0);
  const height = size * 1.6;
  // the canister's body is about as tall as the film coming out of it
  const canister = height * 1.68;
  const canisterWidth = (canister * CANISTER_W) / CANISTER_H;
  const hole = { w: size * 0.26, h: size * 0.17, gap: size * 0.2, edge: size * 0.11 };
  const count = Math.max(0, Math.floor((width - hole.gap) / (hole.w + hole.gap)));
  const start = (width - (count * hole.w + (count - 1) * hole.gap)) / 2;

  return (
    <View style={[styles.wrap, { height: canister, paddingLeft: canisterWidth * 0.86 }]} accessible accessibilityLabel="ShuttInk">
      <View
        style={[styles.film, { height, paddingLeft: size * 0.3, paddingRight: size * 0.4 }]}
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
      {/* drawn last so the film looks like it comes out of its slot */}
      <View style={[styles.canister, { top: (height - canister) / 2 }]}>
        <Canister height={canister} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  film: { flexDirection: 'row', alignItems: 'center' },
  word: { ...bubbly, color: colors.white, textShadowColor: colors.reef, includeFontPadding: false },
  canister: { position: 'absolute', left: 0 },
});

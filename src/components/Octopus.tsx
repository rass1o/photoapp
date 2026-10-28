import { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Text } from './Themed';
import { colors } from '../theme';

// Placeholder mascot art — a simple cartoon octopus drawn in SVG so it can be
// recolored and dressed up. Swap the shapes out once there's a real design.

const OUTLINE = colors.abyss;

// Tentacles are drawn twice (dark wide stroke, then body-colored narrower
// stroke on top) to get a thick cartoon outline.
const TENTACLES = [
  'M60,112 C38,128 26,152 38,170 C46,182 62,176 56,164',
  'M76,120 C68,146 62,172 76,188 C86,198 98,188 90,178',
  'M92,124 C90,150 86,172 95,186',
  'M108,124 C110,150 114,172 105,186',
  'M124,120 C132,146 138,172 124,188 C114,198 102,188 110,178',
  'M140,112 C162,128 174,152 162,170 C154,182 138,176 144,164',
];

type Props = {
  color: string;
  accessory?: string | null;
  heldItem?: string | null;
  size?: number;
  animated?: boolean;
};

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case 'bowtie':
      return (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M100,140 L80,129 L80,151 Z" fill="#ef4444" />
          <Path d="M100,140 L120,129 L120,151 Z" fill="#ef4444" />
          <Circle cx={100} cy={140} r={5.5} fill="#b91c1c" />
        </G>
      );
    case 'round_glasses':
      return (
        <G stroke={OUTLINE} strokeWidth={4} fill="none" strokeLinecap="round">
          <Circle cx={78} cy={88} r={19} fill={colors.white} fillOpacity={0.15} />
          <Circle cx={122} cy={88} r={19} fill={colors.white} fillOpacity={0.15} />
          <Path d="M97,86 Q100,81 103,86" />
          <Path d="M59,84 L44,78" />
          <Path d="M141,84 L156,78" />
        </G>
      );
    case 'bucket_hat':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round">
          <Path d="M64,40 C66,8 134,8 136,40 Z" fill="#d6b98c" />
          <Ellipse cx={100} cy={40} rx={56} ry={11} fill="#c8a675" />
          <Path d="M66,32 L134,32" stroke="#92400e" strokeWidth={4} />
        </G>
      );
    case 'beret':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} rotation={-10} origin="100, 34">
          <Ellipse cx={96} cy={32} rx={50} ry={15} fill={colors.text} />
          <Rect x={92} y={12} width={8} height={8} rx={3} fill={colors.text} />
        </G>
      );
    case 'top_hat':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round">
          <Rect x={72} y={-14} width={56} height={50} rx={4} fill={colors.ink} />
          <Rect x={72} y={22} width={56} height={9} fill="#dc2626" />
          <Ellipse cx={100} cy={36} rx={48} ry={8} fill={colors.ink} />
        </G>
      );
    case 'crown':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round">
          <Path d="M68,38 L72,8 L86,24 L100,2 L114,24 L128,8 L132,38 Z" fill="#fbbf24" />
          <Circle cx={100} cy={28} r={4.5} fill="#ef4444" />
          <Circle cx={82} cy={31} r={3.5} fill="#3b82f6" />
          <Circle cx={118} cy={31} r={3.5} fill="#10b981" />
        </G>
      );
    default:
      return null;
  }
}

// Held items sit at the tip of the right-hand tentacle
function HeldItem({ kind }: { kind: string }) {
  let body = null;
  switch (kind) {
    case 'camera':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Rect x={6} y={-6} width={11} height={7} rx={2} fill={colors.text} />
          <Rect x={0} y={0} width={42} height={28} rx={5} fill={colors.text} />
          <Circle cx={21} cy={14} r={10} fill={colors.faint} />
          <Circle cx={21} cy={14} r={4.5} fill={OUTLINE} />
          <Circle cx={35} cy={6} r={2.5} fill="#fde68a" strokeWidth={0} />
        </G>
      );
      break;
    case 'film_roll':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Rect x={22} y={9} width={20} height={13} fill="#92400e" />
          <Rect x={10} y={-5} width={10} height={6} rx={1} fill={OUTLINE} />
          <Rect x={2} y={0} width={26} height={32} rx={5} fill="#f59e0b" />
          <Rect x={2} y={11} width={26} height={9} fill="#dc2626" />
        </G>
      );
      break;
    case 'coffee':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10,-4 Q6,-10 10,-16 M20,-4 Q16,-10 20,-16" fill="none" stroke={colors.faint} strokeWidth={2.5} />
          <Path d="M30,10 C40,10 40,24 30,24" fill="none" />
          <Rect x={2} y={2} width={28} height={30} rx={5} fill={colors.white} />
          <Ellipse cx={16} cy={6} rx={11} ry={3} fill="#78350f" strokeWidth={0} />
        </G>
      );
      break;
    case 'polaroid':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" rotation={8} origin="17, 20">
          <Rect x={0} y={0} width={34} height={40} rx={2} fill={colors.white} />
          <Rect x={4} y={4} width={26} height={24} fill="#93c5fd" strokeWidth={0} />
          <Circle cx={22} cy={11} r={4} fill="#fde047" strokeWidth={0} />
          <Path d="M4,28 L13,17 L20,24 L24,20 L30,28 Z" fill="#16a34a" strokeWidth={0} />
        </G>
      );
      break;
    case 'flash':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Rect x={4} y={14} width={22} height={24} rx={3} fill={colors.text} />
          <Rect x={-2} y={0} width={34} height={16} rx={3} fill={colors.sandBorder} />
          <Path d="M17,2 L10,9 L15,9 L12,15 L20,7 L15,7 Z" fill="#facc15" strokeWidth={1.5} />
        </G>
      );
      break;
    default:
      return null;
  }
  return <G transform="translate(146, 138)">{body}</G>;
}

export default function Octopus({ color, accessory, heldItem, size = 140, animated = true }: Props) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.04] });

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <Svg width={size} height={size * 1.25} viewBox="0 -30 200 250">
        {TENTACLES.map((d, i) => (
          <Path key={`o${i}`} d={d} stroke={OUTLINE} strokeWidth={24} strokeLinecap="round" fill="none" />
        ))}
        {TENTACLES.map((d, i) => (
          <Path key={`f${i}`} d={d} stroke={color} strokeWidth={17} strokeLinecap="round" fill="none" />
        ))}

        <Ellipse cx={100} cy={82} rx={60} ry={52} fill={color} stroke={OUTLINE} strokeWidth={4} />
        <Ellipse cx={72} cy={54} rx={15} ry={9} fill={colors.white} opacity={0.35} rotation={-30} origin="72, 54" />

        <Ellipse cx={62} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />
        <Ellipse cx={138} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />

        <Ellipse cx={78} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
        <Ellipse cx={122} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
        <Circle cx={80} cy={91} r={7} fill={OUTLINE} />
        <Circle cx={124} cy={91} r={7} fill={OUTLINE} />
        <Circle cx={83} cy={87} r={2.5} fill={colors.white} />
        <Circle cx={127} cy={87} r={2.5} fill={colors.white} />

        <Path d="M90,112 Q100,122 110,112" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none" />

        {accessory ? <Accessory kind={accessory} /> : null}
        {heldItem ? <HeldItem kind={heldItem} /> : null}
      </Svg>
    </Animated.View>
  );
}

// Octopus with its name and a speech bubble, used on profiles
export function OctopusCard({
  name,
  line,
  color,
  accessory,
  heldItem,
  size = 120,
}: {
  name: string;
  line: string;
  color: string;
  accessory?: string | null;
  heldItem?: string | null;
  size?: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{line.replace('{name}', name)}</Text>
        <View style={styles.bubbleTail} />
      </View>
      <Octopus color={color} accessory={accessory} heldItem={heldItem} size={size} />
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.sand,
    borderRadius: 12,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  bubble: {
    backgroundColor: colors.shell,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: OUTLINE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '85%',
    marginBottom: 2,
  },
  bubbleText: { fontSize: 13, color: colors.ink, fontWeight: '500', textAlign: 'center' },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 12,
    height: 12,
    backgroundColor: colors.shell,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: OUTLINE,
    transform: [{ rotate: '45deg' }],
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.deep, marginTop: 2 },
});

import { ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Designed avatar frames. A frame's value is either a plain color (the
// original frames) or one of these design names, which have a ring color
// plus a decoration drawn around the avatar.

const OUTLINE = colors.abyss;

// Drawing space: a 160x160 box with the avatar circle centered at (80, 80),
// radius 50, so decorations can sit around and on top of it.
function Starfish({ x, y, r, rotate = 0, color = '#F97316' }: { x: number; y: number; r: number; rotate?: number; color?: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.45;
    return `${(x + d * Math.cos(a)).toFixed(1)},${(y + d * Math.sin(a)).toFixed(1)}`;
  });
  return (
    <Path
      d={`M${pts.join(' L')} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={2}
      strokeLinejoin="round"
      rotation={rotate}
      origin={`${x}, ${y}`}
    />
  );
}

const DESIGNS: Record<string, { color: string; art: () => ReactElement }> = {
  cat_ears: {
    color: '#2A2533',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M42,52 L40,14 L72,34 Z" fill="#2A2533" />
        <Path d="M118,52 L120,14 L88,34 Z" fill="#2A2533" />
        <Path d="M48,42 L47,25 L62,35 Z" fill="#F9A8D4" strokeWidth={0} />
        <Path d="M112,42 L113,25 L98,35 Z" fill="#F9A8D4" strokeWidth={0} />
      </G>
    ),
  },
  sombrero: {
    color: '#D62828',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Ellipse cx={80} cy={36} rx={70} ry={11} fill="#E9C46A" />
        <Path d="M58,36 C54,6 106,6 102,36 Z" fill="#F4D58D" />
        <Path d="M57,25 L103,25 L102.5,32 L57.5,32 Z" fill="#D62828" strokeWidth={2} />
        <Path d="M12,36 Q80,52 148,36" fill="none" stroke="#C79A3A" strokeWidth={2.5} />
      </G>
    ),
  },
  camera_top: {
    color: '#2C5872',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Rect x={62} y={4} width={12} height={8} rx={2} fill="#2C5872" />
        <Rect x={54} y={10} width={52} height={30} rx={6} fill="#2C5872" />
        <Circle cx={80} cy={25} r={11} fill="#7D9BAC" />
        <Circle cx={80} cy={25} r={5} fill={OUTLINE} />
        <Circle cx={97} cy={17} r={3} fill="#FDE68A" strokeWidth={1.5} />
      </G>
    ),
  },
  starfish: {
    color: '#F97316',
    art: () => (
      <G>
        <Starfish x={28} y={44} r={16} rotate={-15} />
        <Starfish x={134} y={36} r={13} rotate={20} color="#FB7185" />
        <Starfish x={136} y={124} r={15} rotate={8} />
        <Starfish x={26} y={128} r={12} rotate={-25} color="#FDE047" />
      </G>
    ),
  },
  bubbles: {
    color: '#38BDF8',
    art: () => (
      <G fill="#FFFFFF" fillOpacity={0.55} stroke="#38BDF8" strokeWidth={3}>
        <Circle cx={138} cy={50} r={12} />
        <Circle cx={150} cy={78} r={7} />
        <Circle cx={128} cy={24} r={6} />
        <Circle cx={22} cy={112} r={10} />
        <Circle cx={14} cy={86} r={6} />
        <Circle cx={32} cy={136} r={5} />
      </G>
    ),
  },
  kelp: {
    color: '#16A34A',
    art: () => (
      <G strokeLinecap="round" fill="none">
        <Path d="M26,156 C14,124 34,108 22,80 M44,156 C40,134 52,120 44,104" stroke={OUTLINE} strokeWidth={11} />
        <Path d="M26,156 C14,124 34,108 22,80 M44,156 C40,134 52,120 44,104" stroke="#4ADE80" strokeWidth={6} />
        <Path d="M134,156 C146,124 126,108 138,80 M116,156 C120,134 108,120 116,104" stroke={OUTLINE} strokeWidth={11} />
        <Path d="M134,156 C146,124 126,108 138,80 M116,156 C120,134 108,120 116,104" stroke="#22C55E" strokeWidth={6} />
      </G>
    ),
  },
  film_strip: {
    color: '#111827',
    art: () => (
      <G fill="none">
        <Circle cx={80} cy={80} r={62} stroke="#111827" strokeWidth={16} />
        <Circle cx={80} cy={80} r={68} stroke="#E5E7EB" strokeWidth={3} strokeDasharray="5 7" />
        <Circle cx={80} cy={80} r={56} stroke="#E5E7EB" strokeWidth={3} strokeDasharray="5 7" />
      </G>
    ),
  },
  tentacle_hug: {
    color: '#a78bfa',
    art: () => (
      <G strokeLinecap="round" fill="none">
        <Path d="M60,150 C24,150 8,110 22,80 C30,62 46,66 40,78" stroke={OUTLINE} strokeWidth={15} />
        <Path d="M100,150 C136,150 152,110 138,80 C130,62 114,66 120,78" stroke={OUTLINE} strokeWidth={15} />
        <Path d="M60,150 C24,150 8,110 22,80 C30,62 46,66 40,78" stroke="#a78bfa" strokeWidth={10} />
        <Path d="M100,150 C136,150 152,110 138,80 C130,62 114,66 120,78" stroke="#a78bfa" strokeWidth={10} />
        <G fill="#F5D0FE" stroke={OUTLINE} strokeWidth={1}>
          <Circle cx={30} cy={128} r={2.6} />
          <Circle cx={18} cy={104} r={2.6} />
          <Circle cx={130} cy={128} r={2.6} />
          <Circle cx={142} cy={104} r={2.6} />
        </G>
      </G>
    ),
  },
  pearls: {
    color: '#E8C26A',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={1.5}>
        {Array.from({ length: 22 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 22;
          return <Circle key={i} cx={80 + 58 * Math.cos(a)} cy={80 + 58 * Math.sin(a)} r={5} fill="#FFF7ED" />;
        })}
        <Path d="M80,4 C64,4 58,20 64,30 L96,30 C102,20 96,4 80,4 Z" fill="#F9A8D4" strokeWidth={2.5} />
        <Path d="M80,8 L80,28 M71,10 L74,28 M89,10 L86,28" stroke="#DB2777" strokeWidth={1.5} />
      </G>
    ),
  },
};

export const FRAME_DESIGNS = Object.keys(DESIGNS);

// The color of the ring around the avatar (plain frames are just a color)
export function frameColor(value: string | null | undefined) {
  if (!value) return '#7c3aed';
  return DESIGNS[value]?.color ?? value;
}

// Draws a designed frame's decoration over an avatar of the given size.
// Put it inside a wrapper the same size as the avatar; plain colors draw nothing.
export default function FrameDecoration({ value, size }: { value: string | null | undefined; size: number }) {
  const design = value ? DESIGNS[value] : undefined;
  if (!design) return null;
  const box = size * 1.6; // the 160-unit box, where the avatar is 100 units wide
  return (
    <View pointerEvents="none" style={[styles.overlay, { width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }]}>
      <Svg width={box} height={box} viewBox="0 0 160 160">
        {design.art()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
});

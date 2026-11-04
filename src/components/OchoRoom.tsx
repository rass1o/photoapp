import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

// The room Ocho gets dressed up in. Each room is a palette for the same
// furniture for now; more rooms (and buying them) can be added to ROOMS later.

type RoomLook = {
  wall: string;
  stripe: string;
  floor: string;
  plank: string;
  rug: string;
  rugTrim: string;
};

export const ROOMS: Record<string, RoomLook> = {
  cozy: {
    wall: '#F7E3C8',
    stripe: '#F1D6B4',
    floor: '#C99A6B',
    plank: '#B5855A',
    rug: '#E8664A',
    rugTrim: '#FFD2C2',
  },
};

const OUTLINE = colors.abyss;
const W = 400;
const H = 300;
const FLOOR_Y = 214;

// Light bulbs hanging along the string, alternating colors
const BULBS = [
  { x: 30, c: '#FDE047' },
  { x: 80, c: '#F472B6' },
  { x: 130, c: '#7DD3FC' },
  { x: 180, c: '#86EFAC' },
  { x: 230, c: '#FDE047' },
  { x: 280, c: '#F472B6' },
  { x: 330, c: '#7DD3FC' },
  { x: 375, c: '#86EFAC' },
];
const sag = (x: number) => 14 + 16 * Math.sin((Math.PI * x) / W);

function RoomArt({ look }: { look: RoomLook }) {
  return (
    <G>
      <Defs>
        <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7DD3FC" />
          <Stop offset="1" stopColor="#0E86A8" />
        </LinearGradient>
      </Defs>

      {/* wall with soft stripes */}
      <Rect x={0} y={0} width={W} height={FLOOR_Y} fill={look.wall} />
      {Array.from({ length: 17 }, (_, i) => (
        <Rect key={i} x={i * 24 + 6} y={0} width={10} height={FLOOR_Y} fill={look.stripe} />
      ))}

      {/* wooden floor and baseboard */}
      <Rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill={look.floor} />
      {[FLOOR_Y + 22, FLOOR_Y + 48, FLOOR_Y + 74].map((y) => (
        <Path key={y} d={`M0,${y} L${W},${y}`} stroke={look.plank} strokeWidth={2} />
      ))}
      {[60, 170, 290, 120, 240, 350].map((x, i) => (
        <Path
          key={i}
          d={`M${x},${FLOOR_Y + (i < 3 ? 0 : 22)} l0,22`}
          stroke={look.plank}
          strokeWidth={2}
        />
      ))}
      <Rect x={0} y={FLOOR_Y - 8} width={W} height={10} fill="#EFDDBF" stroke={OUTLINE} strokeWidth={2} />

      {/* porthole window with the sea outside */}
      <G stroke={OUTLINE} strokeWidth={3}>
        <Circle cx={72} cy={96} r={40} fill="#D4A017" />
        <Circle cx={72} cy={96} r={30} fill="url(#sea)" />
        <Path d="M56,104 C60,98 70,98 74,104 C70,110 60,110 56,104 Z M74,104 L80,99 L80,109 Z" fill="#FDE68A" strokeWidth={1.5} />
        <Path d="M66,82 Q69,76 66,70" stroke="#3FA796" strokeWidth={3} fill="none" />
        <Circle cx={86} cy={84} r={3} fill="#FFFFFF" fillOpacity={0.6} strokeWidth={1} />
        <Circle cx={90} cy={74} r={2} fill="#FFFFFF" fillOpacity={0.6} strokeWidth={1} />
        <Path d="M50,82 Q58,72 70,70" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={3} fill="none" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return <Circle key={deg} cx={72 + 35 * Math.cos(a)} cy={96 + 35 * Math.sin(a)} r={2} fill="#8A6A0C" strokeWidth={0} />;
        })}
      </G>

      {/* framed photo: a little landscape, it's a photographer's room */}
      <G stroke={OUTLINE} strokeWidth={3}>
        <Rect x={290} y={44} width={78} height={60} rx={3} fill="#7A4A2A" />
        <Rect x={298} y={52} width={62} height={44} fill="#BDE6EF" strokeWidth={2} />
        <Circle cx={344} cy={64} r={6} fill="#FDE047" strokeWidth={0} />
        <Path d="M298,96 L318,72 L332,86 L342,76 L360,96 Z" fill="#3FA796" strokeWidth={2} />
      </G>

      {/* shelf with a camera, a film roll and a tiny plant */}
      <G stroke={OUTLINE} strokeWidth={2.5}>
        <Rect x={282} y={124} width={96} height={8} rx={2} fill="#A86F43" />
        <Rect x={292} y={104} width={30} height={20} rx={4} fill="#2C5872" />
        <Circle cx={307} cy={114} r={6} fill="#7D9BAC" />
        <Rect x={296} y={100} width={8} height={5} rx={1} fill="#2C5872" />
        <Rect x={330} y={106} width={12} height={18} rx={3} fill="#F59E0B" />
        <Rect x={330} y={112} width={12} height={5} fill="#DC2626" strokeWidth={0} />
        <Path d="M354,124 L356,114 L370,114 L372,124 Z" fill="#E8664A" />
        <Path d="M363,114 Q358,104 362,98 M363,114 Q368,104 366,96" stroke="#3FA796" strokeWidth={3} fill="none" />
      </G>

      {/* kelp in a pot */}
      <G stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
        <Path d="M30,206 C22,180 36,168 28,146 M42,206 C46,176 34,160 42,130 M54,206 C62,186 52,172 60,156" stroke="#2F8F6B" strokeWidth={9} fill="none" />
        <Path d="M30,206 C22,180 36,168 28,146 M42,206 C46,176 34,160 42,130 M54,206 C62,186 52,172 60,156" stroke="#4ADE80" strokeWidth={4} fill="none" />
        <Path d="M22,204 L64,204 L58,234 L28,234 Z" fill="#E8664A" />
        <Rect x={18} y={198} width={50} height={9} rx={3} fill="#C2410C" />
      </G>

      {/* floor lamp */}
      <G stroke={OUTLINE} strokeWidth={3}>
        <Ellipse cx={358} cy={236} rx={16} ry={5} fill="#2C5872" />
        <Path d="M358,236 L358,170" strokeWidth={4} />
        <Path d="M338,170 L378,170 L370,146 L346,146 Z" fill="#FDE68A" />
        <Ellipse cx={358} cy={176} rx={26} ry={10} fill="#FEF9C3" opacity={0.6} strokeWidth={0} />
      </G>

      {/* rug for Ocho to stand on */}
      <Ellipse cx={200} cy={262} rx={128} ry={24} fill={look.rug} stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={200} cy={262} rx={104} ry={16} fill="none" stroke={look.rugTrim} strokeWidth={3} strokeDasharray="10 7" />

      {/* string lights */}
      <Path
        d={`M0,${sag(0)} ${Array.from({ length: 21 }, (_, i) => `L${i * 20},${sag(i * 20)}`).join(' ')}`}
        stroke={OUTLINE}
        strokeWidth={2}
        fill="none"
      />
      {BULBS.map((b) => (
        <G key={b.x}>
          <Rect x={b.x - 3} y={sag(b.x) - 1} width={6} height={5} fill={OUTLINE} />
          <Ellipse cx={b.x} cy={sag(b.x) + 10} rx={5} ry={7} fill={b.c} stroke={OUTLINE} strokeWidth={1.5} />
        </G>
      ))}
    </G>
  );
}

// The room fills its box; children (Ocho) stand on the rug at the bottom
export default function OchoRoom({
  room = 'cozy',
  height,
  children,
}: {
  room?: string;
  height: number;
  children: ReactNode;
}) {
  const look = ROOMS[room] ?? ROOMS.cozy;
  return (
    <View style={[styles.room, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <RoomArt look={look} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
});

import { ReactElement, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSettings } from '../context/SettingsContext';
import { useScreenFocused } from '../lib/useScreenFocused';
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


// --- little pieces the frames are built from ---------------------------------

function Heart({ x, y, s = 1, color = '#FB7185', rotate = 0 }: { x: number; y: number; s?: number; color?: string; rotate?: number }) {
  return (
    <Path
      d="M0,6 C-7,1 -9,-3 -9,-6 C-9,-9.5 -6,-11 -3.5,-11 C-1.8,-11 -0.6,-10 0,-8.6 C0.6,-10 1.8,-11 3.5,-11 C6,-11 9,-9.5 9,-6 C9,-3 7,1 0,6 Z"
      fill={color}
      stroke={OUTLINE}
      strokeWidth={2 / s}
      strokeLinejoin="round"
      transform={`translate(${x},${y}) rotate(${rotate}) scale(${s})`}
    />
  );
}

function Sparkle({ x, y, r, color = '#FACC15' }: { x: number; y: number; r: number; color?: string }) {
  const k = r * 0.28;
  return (
    <Path
      d={`M${x},${y - r} Q${x + k},${y - k} ${x + r},${y} Q${x + k},${y + k} ${x},${y + r} Q${x - k},${y + k} ${x - r},${y} Q${x - k},${y - k} ${x},${y - r} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

// Five round petals and a middle
function Flower({ x, y, r, color, middle = '#FDE047' }: { x: number; y: number; r: number; color: string; middle?: string }) {
  return (
    <G stroke={OUTLINE} strokeWidth={1.5}>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return <Circle key={i} cx={x + r * 0.62 * Math.cos(a)} cy={y + r * 0.62 * Math.sin(a)} r={r * 0.48} fill={color} />;
      })}
      <Circle cx={x} cy={y} r={r * 0.34} fill={middle} />
    </G>
  );
}

function Leaf({ x, y, r, rotate, color = '#4ADE80' }: { x: number; y: number; r: number; rotate: number; color?: string }) {
  return (
    <Path
      d={`M0,0 C${r * 0.4},${-r * 0.5} ${r},${-r * 0.4} ${r * 1.4},0 C${r},${r * 0.4} ${r * 0.4},${r * 0.5} 0,0 Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={1.5}
      transform={`translate(${x},${y}) rotate(${rotate})`}
    />
  );
}

// A scallop shell, ridges fanning from the hinge
function Shell({ x, y, r, rotate = 0, color = '#FBCFE8' }: { x: number; y: number; r: number; rotate?: number; color?: string }) {
  return (
    <G transform={`translate(${x},${y}) rotate(${rotate}) scale(${r / 10})`} stroke={OUTLINE} strokeLinejoin="round">
      <Path d="M-10,2 C-10,-9 10,-9 10,2 C7,6 -7,6 -10,2 Z" fill={color} strokeWidth={1.6} />
      <Path d="M0,6 L0,-6 M0,6 L-5,-5 M0,6 L5,-5 M0,6 L-8,-1 M0,6 L8,-1" stroke={OUTLINE} strokeWidth={0.9} fill="none" />
      <Path d="M-3,6 L-3,9 L3,9 L3,6" fill={color} strokeWidth={1.4} />
    </G>
  );
}

function Snowflake({ x, y, r }: { x: number; y: number; r: number }) {
  const arms = `M0,${-r} L0,${r} M${-r * 0.3},${-r * 0.75} L0,${-r * 0.5} L${r * 0.3},${-r * 0.75} M${-r * 0.3},${r * 0.75} L0,${r * 0.5} L${r * 0.3},${r * 0.75}`;
  return (
    <G strokeLinecap="round" transform={`translate(${x},${y})`}>
      {[0, 60, 120].map((a) => (
        <G key={a} rotation={a} origin="0, 0">
          <Path d={arms} stroke={OUTLINE} strokeWidth={4.4} />
          <Path d={arms} stroke="#BAE6FD" strokeWidth={2.2} />
        </G>
      ))}
      <Circle cx={0} cy={0} r={r * 0.2} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.2} />
    </G>
  );
}

function Butterfly({ x, y, s, rotate = 0, wing, spot }: { x: number; y: number; s: number; rotate?: number; wing: string; spot: string }) {
  return (
    <G transform={`translate(${x},${y}) rotate(${rotate}) scale(${s})`} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round">
      <Path d="M0,0 C-6,-12 -16,-12 -15,-3 C-14,3 -6,3 0,0 Z" fill={wing} />
      <Path d="M0,0 C6,-12 16,-12 15,-3 C14,3 6,3 0,0 Z" fill={wing} />
      <Path d="M0,0 C-5,4 -11,9 -8,12 C-5,14 -2,7 0,0 Z" fill={spot} />
      <Path d="M0,0 C5,4 11,9 8,12 C5,14 2,7 0,0 Z" fill={spot} />
      <Path d="M0,-5 L0,7" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M0,-5 Q-2,-10 -4,-11 M0,-5 Q2,-10 4,-11" fill="none" strokeLinecap="round" />
    </G>
  );
}

function Flame({ x, y, s, rotate = 0 }: { x: number; y: number; s: number; rotate?: number }) {
  return (
    <G transform={`translate(${x},${y}) rotate(${rotate}) scale(${s})`} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round">
      <Path d="M0,10 C-9,10 -11,2 -7,-4 C-5,-7 -5,-11 -3,-14 C-1,-9 3,-9 4,-13 C9,-6 11,0 9,5 C7,9 4,10 0,10 Z" fill="#F97316" />
      <Path d="M0,10 C-5,10 -6,5 -3,1 C-2,-1 -1,-4 0,-6 C2,-2 5,1 4,5 C3,8 2,10 0,10 Z" fill="#FDE047" strokeWidth={0} />
    </G>
  );
}

function Coin({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <G stroke={OUTLINE} strokeWidth={1.5}>
      <Circle cx={x} cy={y} r={r} fill="#FACC15" />
      <Circle cx={x} cy={y} r={r * 0.6} fill="none" stroke="#CA8A04" strokeWidth={1.2} />
    </G>
  );
}

function Gem({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <Path
      d="M-6,-3 L-3,-7 L3,-7 L6,-3 L0,7 Z M-6,-3 L6,-3 M-3,-7 L-1.5,-3 L0,7 M3,-7 L1.5,-3"
      fill={color}
      stroke={OUTLINE}
      strokeWidth={1.3}
      strokeLinejoin="round"
      transform={`translate(${x},${y}) scale(${s})`}
    />
  );
}

// A thick outlined stroke, like Ocho's tentacles
function Band({ d, color, w }: { d: string; color: string; w: number }) {
  return (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} stroke={OUTLINE} strokeWidth={w + 5} />
      <Path d={d} stroke={color} strokeWidth={w} />
    </G>
  );
}

// Points around the photo circle (angle in degrees, 0 = right, 90 = down)
const around = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: 80 + r * Math.cos(a), y: 80 + r * Math.sin(a) };
};


// --- the legendary frames that move are drawn in parts, so the moving part
// can sit on its own layer (see LIVE below) ----------------------------------

function OchoPeekBody() {
  return (
    <G strokeLinejoin="round" strokeLinecap="round">
      <Band d="M38,40 C14,52 8,90 22,112 C30,124 40,118 36,108" color="#A78BFA" w={10} />
      <Band d="M122,40 C146,52 152,90 138,112 C130,124 120,118 124,108" color="#A78BFA" w={10} />
      <Path d="M30,44 C30,-4 130,-4 130,44 C116,36 44,36 30,44 Z" fill="#A78BFA" stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={58} cy={14} rx={8} ry={5} fill="#FFFFFF" opacity={0.45} rotation={-25} origin="58, 14" />
      <Circle cx={66} cy={28} r={7.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} />
      <Circle cx={94} cy={28} r={7.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} />
      <G fill="#F5D0FE" stroke={OUTLINE} strokeWidth={1}>
        <Circle cx={18} cy={86} r={2.4} />
        <Circle cx={142} cy={86} r={2.4} />
        <Circle cx={22} cy={104} r={2.4} />
        <Circle cx={138} cy={104} r={2.4} />
      </G>
    </G>
  );
}

function OchoPeekPupils() {
  return (
    <G>
      <Circle cx={67} cy={31} r={4} fill={OUTLINE} />
      <Circle cx={95} cy={31} r={4} fill={OUTLINE} />
      <Circle cx={68.5} cy={29} r={1.4} fill="#FFFFFF" />
      <Circle cx={96.5} cy={29} r={1.4} fill="#FFFFFF" />
    </G>
  );
}

function AnglerBody() {
  return (
    <G strokeLinejoin="round" strokeLinecap="round">
      <Path d="M120,118 C112,70 74,10 30,18" fill="none" stroke={OUTLINE} strokeWidth={5} />
      <Path d="M120,118 C112,70 74,10 30,18" fill="none" stroke="#475569" strokeWidth={2.5} />
      <Path d="M104,120 C110,100 152,98 160,124 C152,150 112,150 104,128 Z" fill="#334155" stroke={OUTLINE} strokeWidth={3} />
      <Path d="M108,124 L116,120 L120,128 L126,121 L130,129 L136,122 L140,130" fill="none" stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={134} cy={112} r={5} fill="#FDE047" stroke={OUTLINE} strokeWidth={1.8} />
      <Circle cx={135} cy={113} r={2.2} fill={OUTLINE} />
    </G>
  );
}

function AnglerLight() {
  return (
    <G>
      <Circle cx={30} cy={24} r={20} fill="#FEF9C3" opacity={0.35} />
      <Circle cx={30} cy={24} r={8} fill="#FDE047" stroke={OUTLINE} strokeWidth={2.5} />
      <Circle cx={28} cy={22} r={3} fill="#FFFFFF" />
    </G>
  );
}

function RoyalCrown() {
  return (
    <G strokeLinejoin="round" stroke={OUTLINE}>
      <Path d="M48,34 L44,8 L62,20 L80,3 L98,20 L116,8 L112,34 Z" fill="#FACC15" strokeWidth={3} />
      <Rect x={46} y={30} width={68} height={10} rx={3} fill="#EAB308" strokeWidth={3} />
      <Gem x={80} y={18} s={0.9} color="#EF4444" />
      <Circle cx={62} cy={26} r={3.5} fill="#38BDF8" strokeWidth={1.4} />
      <Circle cx={98} cy={26} r={3.5} fill="#4ADE80" strokeWidth={1.4} />
      {/* laurel branches curving up both sides */}
      <Path d="M76,144 A64,64 0 0 1 17,92 M84,144 A64,64 0 0 0 143,92" fill="none" stroke="#A16207" strokeWidth={2.5} strokeLinecap="round" />
      {[110, 125, 140, 155, 170].map((deg) => {
        const p = around(deg, 62);
        return <Leaf key={deg} x={p.x} y={p.y} r={9} rotate={deg + 120} color="#CA8A04" />;
      })}
      {[70, 55, 40, 25, 10].map((deg) => {
        const p = around(deg, 62);
        return <Leaf key={deg} x={p.x} y={p.y} r={9} rotate={deg + 60} color="#CA8A04" />;
      })}
    </G>
  );
}

// the glints that flash on the crown's jewels
const ROYAL_GLINTS = [
  { x: 84, y: 12, r: 5 },
  { x: 65, y: 22, r: 4 },
  { x: 101, y: 22, r: 4 },
];

function JellyTentacles({ side }: { side: 'left' | 'right' }) {
  const d =
    side === 'left'
      ? 'M40,34 C22,54 22,84 12,116 M50,38 C32,62 32,92 26,128'
      : 'M120,34 C138,54 138,84 148,116 M110,38 C128,62 128,92 134,128';
  return (
    <G strokeLinejoin="round" strokeLinecap="round" fill="none">
      <Path d={d} stroke={OUTLINE} strokeWidth={5} />
      <Path d={d} stroke="#F5D0FE" strokeWidth={2.6} />
    </G>
  );
}

function JellyBell() {
  return (
    <G strokeLinejoin="round" strokeLinecap="round">
      <Ellipse cx={80} cy={16} rx={52} ry={14} fill="#F0ABFC" opacity={0.3} />
      <Path d="M38,34 C38,-6 122,-6 122,34 Q114,40 106,34 Q98,40 90,34 Q82,40 74,34 Q66,40 58,34 Q50,40 38,34 Z" fill="#E879F9" stroke={OUTLINE} strokeWidth={3} />
      <Path d="M54,16 Q66,4 82,4" fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.7} />
      <Circle cx={70} cy={22} r={3} fill={OUTLINE} />
      <Circle cx={90} cy={22} r={3} fill={OUTLINE} />
      <Path d="M76,28 Q80,31 84,28" fill="none" stroke={OUTLINE} strokeWidth={2} />
      <Sparkle x={140} y={14} r={6} color="#F5D0FE" />
    </G>
  );
}

// The cat on the cat_purr frame: a black cat with a pink collar, curled up
// asleep along the top of the photo, tail hanging down the right side
function SleepyCat() {
  return (
    <G strokeLinejoin="round" strokeLinecap="round">
      <Band d="M124,40 C142,50 150,72 144,92 C140,104 130,104 132,96" color="#2A2533" w={8} />
      <Path d="M44,46 C40,20 66,8 94,10 C118,12 132,26 128,46 C104,40 70,40 44,46 Z" fill="#2A2533" stroke={OUTLINE} strokeWidth={3} />
      <Path d="M80,16 C92,14 104,18 112,26" fill="none" stroke="#3F3A4A" strokeWidth={3} />
      {/* front paws hanging over the edge */}
      <Ellipse cx={62} cy={46} rx={8} ry={5} fill="#2A2533" stroke={OUTLINE} strokeWidth={2.4} />
      <Ellipse cx={78} cy={44} rx={8} ry={5} fill="#2A2533" stroke={OUTLINE} strokeWidth={2.4} />
      {/* head resting on the left */}
      <Path d="M28,22 L26,5 L40,14 Z M52,14 L60,3 L62,18 Z" fill="#2A2533" stroke={OUTLINE} strokeWidth={2.5} />
      <Path d="M30,18 L29,9 L36,14 Z M54,14 L58,7 L59,17 Z" fill="#F9A8D4" />
      <Circle cx={44} cy={30} r={18} fill="#2A2533" stroke={OUTLINE} strokeWidth={3} />
      <Path d="M33,30 Q37,34 41,30 M47,30 Q51,34 55,30" fill="none" stroke="#C6E35B" strokeWidth={2} />
      <Path d="M42,36 L46,36 L44,38.5 Z" fill="#F9A8D4" />
      <Path d="M30,36 L20,34 M30,39 L21,41 M58,36 L68,34 M58,39 L67,41" stroke="#E5E7EB" strokeWidth={1} />
      {/* pink collar with a little bell */}
      <Path d="M30,44 Q44,52 60,42" fill="none" stroke={OUTLINE} strokeWidth={7} />
      <Path d="M30,44 Q44,52 60,42" fill="none" stroke="#F472B6" strokeWidth={4} />
      <Circle cx={46} cy={50} r={4} fill="#FACC15" stroke={OUTLINE} strokeWidth={1.8} />
    </G>
  );
}

// The same cat, purring: it breathes slowly, and every few seconds a purr
// rumbles through it (a quick tremble) with little purr marks by its head
function PurringCat({ box }: { box: number }) {
  const breathe = useSharedValue(0);
  const purr = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    purr.value = withRepeat(
      withSequence(withTiming(1, { duration: 200 }), withDelay(1200, withTiming(0, { duration: 300 })), withDelay(1500, withTiming(0, { duration: 0 }))),
      -1,
      false
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(purr);
    };
  }, [breathe, purr]);
  const k = box / 160;
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breathe.value * 1.2 * k },
      { scaleY: 1 + 0.025 * breathe.value },
      // a fine rumble while purring
      { translateX: purr.value * Math.sin(Date.now() / 18) * 0.7 * k },
    ],
  }));
  const marks = useAnimatedStyle(() => ({ opacity: purr.value, transform: [{ translateY: -purr.value * 3 * k }] }));
  return (
    <>
      <Reanimated.View style={[StyleSheet.absoluteFill, { transformOrigin: [80 * k, 46 * k, 0] }, body]}>
        <Svg width={box} height={box} viewBox="0 0 160 160">
          <SleepyCat />
        </Svg>
      </Reanimated.View>
      <Reanimated.View style={[StyleSheet.absoluteFill, marks]}>
        <Svg width={box} height={box} viewBox="0 0 160 160">
          <Path d="M10,22 Q4,16 10,10 M4,30 Q-4,22 4,14" fill="none" stroke="#F9A8D4" strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M70,4 Q76,-2 82,4" fill="none" stroke="#F9A8D4" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Reanimated.View>
    </>
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

  // --- common ---------------------------------------------------------------
  peace_sign: {
    color: '#22C55E',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
        <Circle cx={126} cy={126} r={19} fill="#BBF7D0" />
        <Circle cx={126} cy={126} r={12.5} fill="none" />
        <Path d="M126,113.5 L126,138.5 M126,126 L117.2,134.8 M126,126 L134.8,134.8" fill="none" />
        <Sparkle x={30} y={36} r={7} color="#86EFAC" />
      </G>
    ),
  },
  hearts: {
    color: '#FB7185',
    art: () => (
      <G>
        <Heart x={28} y={42} s={1.3} rotate={-18} />
        <Heart x={134} y={32} s={1} rotate={14} color="#F9A8D4" />
        <Heart x={142} y={112} s={1.2} rotate={12} />
        <Heart x={20} y={118} s={0.9} rotate={-10} color="#F9A8D4" />
      </G>
    ),
  },

  // --- uncommon -------------------------------------------------------------
  glasses_top: {
    color: '#1F2937',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M34,34 Q80,22 126,34" fill="none" stroke="#1F2937" strokeWidth={4} />
        <Path d="M42,26 H74 V34 C74,44 66,48 58,48 C48,48 42,42 42,34 Z" fill="#111827" />
        <Path d="M86,26 H118 V34 C118,42 112,48 102,48 C94,48 86,44 86,34 Z" fill="#111827" />
        <Path d="M74,30 Q80,25 86,30" fill="none" />
        <Path d="M48,32 L58,30 M92,32 L102,30" stroke="#38BDF8" strokeWidth={2.5} strokeLinecap="round" />
      </G>
    ),
  },
  snapback: {
    color: '#2563EB',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M40,46 C38,8 116,2 120,42 Z" fill="#2563EB" />
        <Path d="M114,40 C132,34 150,38 154,46 C140,50 124,50 108,46 Z" fill="#1E40AF" />
        <Path d="M80,8 C76,22 76,34 80,44 M58,14 C60,26 62,36 64,45" fill="none" strokeWidth={1.6} stroke="#1E3A8A" />
        <Circle cx={80} cy={8} r={3.5} fill="#1E40AF" strokeWidth={2} />
        <Path d="M92,24 L96,30 L103,30 L97.5,34 L99.5,41 L92,37 L84.5,41 L86.5,34 L81,30 L88,30 Z" fill="#FDE047" strokeWidth={1.5} />
      </G>
    ),
  },
  headphones: {
    color: '#F472B6',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M26,84 C24,22 136,22 134,84" fill="none" stroke={OUTLINE} strokeWidth={11} strokeLinecap="round" />
        <Path d="M26,84 C24,22 136,22 134,84" fill="none" stroke="#475569" strokeWidth={6} strokeLinecap="round" />
        <Rect x={14} y={66} width={22} height={38} rx={10} fill="#F472B6" />
        <Rect x={124} y={66} width={22} height={38} rx={10} fill="#F472B6" />
        <Rect x={19} y={72} width={8} height={26} rx={4} fill="#FBCFE8" strokeWidth={0} />
        <Rect x={133} y={72} width={8} height={26} rx={4} fill="#FBCFE8" strokeWidth={0} />
      </G>
    ),
  },
  shells: {
    color: '#F9A8D4',
    art: () => (
      <G>
        <Shell x={26} y={40} r={13} rotate={-30} />
        <Shell x={138} y={50} r={11} rotate={28} color="#FDE68A" />
        <Shell x={136} y={128} r={14} rotate={150} color="#FED7AA" />
        <Shell x={22} y={122} r={10} rotate={200} />
      </G>
    ),
  },
  daisies: {
    color: '#FACC15',
    art: () => (
      <G>
        {[100, 122, 144, 166, 188].map((deg, i) => {
          const p = around(deg, 60);
          return <Flower key={deg} x={p.x} y={p.y} r={i % 2 ? 9 : 11} color="#FFFFFF" middle="#FACC15" />;
        })}
        <Leaf x={64} y={140} r={9} rotate={20} />
        <Leaf x={22} y={98} r={8} rotate={-110} />
      </G>
    ),
  },
  sparkles: {
    color: '#EAB308',
    art: () => (
      <G>
        <Sparkle x={30} y={30} r={13} />
        <Sparkle x={140} y={44} r={9} color="#FDE68A" />
        <Sparkle x={134} y={132} r={12} />
        <Sparkle x={22} y={110} r={7} color="#FDE68A" />
        <Sparkle x={150} y={92} r={5} />
      </G>
    ),
  },
  beanie: {
    color: '#EF4444',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M40,42 C40,4 120,4 120,42 Z" fill="#EF4444" />
        <Path d="M60,10 C58,22 58,32 60,42 M80,6 C80,20 80,30 80,42 M100,10 C102,22 102,32 100,42" fill="none" stroke="#B91C1C" strokeWidth={2} />
        <Rect x={34} y={36} width={92} height={16} rx={7} fill="#FCA5A5" />
        <Path d="M46,38 V50 M58,38 V50 M70,38 V50 M82,38 V50 M94,38 V50 M106,38 V50 M118,38 V50" stroke="#EF4444" strokeWidth={2} />
        <Circle cx={80} cy={11} r={8} fill="#FFFFFF" />
      </G>
    ),
  },

  // --- rare -----------------------------------------------------------------
  flowers: {
    color: '#F472B6',
    art: () => (
      <G>
        {Array.from({ length: 14 }, (_, i) => {
          const deg = (360 / 14) * i;
          const p = around(deg, 61);
          return <Leaf key={`l${i}`} x={p.x} y={p.y} r={8} rotate={deg + 60} />;
        })}
        {Array.from({ length: 14 }, (_, i) => {
          const p = around((360 / 14) * i + 12, 61);
          const c = ['#F472B6', '#FB923C', '#FDE047', '#C084FC', '#FFFFFF'][i % 5];
          return <Flower key={`f${i}`} x={p.x} y={p.y} r={i % 2 ? 8 : 10} color={c} middle={c === '#FDE047' ? '#FB923C' : '#FDE047'} />;
        })}
      </G>
    ),
  },
  coral: {
    color: '#FB7185',
    art: () => (
      <G>
        <Band d="M22,150 L22,112 M22,128 L8,114 M22,120 L36,100 M36,100 L32,92" color="#FB7185" w={7} />
        <Band d="M44,152 C40,138 50,128 46,116" color="#F97316" w={6} />
        <Band d="M138,150 L138,104 M138,124 L124,110 M138,116 L152,96 M124,110 L122,100" color="#C084FC" w={7} />
        <Band d="M116,152 C120,140 112,130 116,120" color="#FB7185" w={5} />
        <G stroke={OUTLINE} strokeWidth={2}>
          <Ellipse cx={134} cy={30} rx={13} ry={9} fill="#FDBA74" />
          <Path d="M124,30 Q129,24 134,30 T144,30" fill="none" stroke="#EA580C" strokeWidth={1.8} />
        </G>
        <Band d="M24,40 L24,22 M24,32 L16,24 M24,28 L32,18" color="#F472B6" w={5} />
      </G>
    ),
  },
  halo: {
    color: '#FACC15',
    art: () => (
      <G>
        <Ellipse cx={80} cy={18} rx={40} ry={9} fill="none" stroke="#FEF08A" strokeWidth={10} opacity={0.5} />
        <Ellipse cx={80} cy={18} rx={36} ry={8} fill="none" stroke={OUTLINE} strokeWidth={8} />
        <Ellipse cx={80} cy={18} rx={36} ry={8} fill="none" stroke="#FACC15" strokeWidth={4.5} />
        <Sparkle x={26} y={30} r={7} color="#FEF08A" />
        <Sparkle x={136} y={28} r={6} color="#FEF08A" />
      </G>
    ),
  },
  devil_horns: {
    color: '#DC2626',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <Path d="M42,40 C32,30 30,14 36,4 C42,16 52,22 60,26 Z" fill="#DC2626" />
        <Path d="M118,40 C128,30 130,14 124,4 C118,16 108,22 100,26 Z" fill="#DC2626" />
        <Path d="M120,130 C140,138 148,124 144,112" fill="none" stroke={OUTLINE} strokeWidth={7} strokeLinecap="round" />
        <Path d="M120,130 C140,138 148,124 144,112" fill="none" stroke="#DC2626" strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M144,102 L152,116 L136,114 Z" fill="#DC2626" />
      </G>
    ),
  },
  sunflower: {
    color: '#92400E',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round">
        {Array.from({ length: 22 }, (_, i) => (
          <Path
            key={i}
            d="M80,24 C74,16 74,8 80,2 C86,8 86,16 80,24 Z"
            fill={i % 2 ? '#FACC15' : '#FDE047'}
            rotation={(360 / 22) * i}
            origin="80, 80"
          />
        ))}
      </G>
    ),
  },
  rainbow: {
    color: '#60A5FA',
    art: () => (
      <G fill="none" strokeLinecap="round" transform="translate(0,8)">
        <Path d="M14,74 A66,66 0 0 1 146,74" stroke={OUTLINE} strokeWidth={27} />
        {['#EF4444', '#FB923C', '#FDE047', '#4ADE80', '#60A5FA'].map((c, i) => (
          <Path key={c} d={`M${16 + i * 4.6},74 A${64 - i * 4.6},${64 - i * 4.6} 0 0 1 ${144 - i * 4.6},74`} stroke={c} strokeWidth={4.6} />
        ))}
        <G fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.5}>
          <Path d="M4,84 C2,74 12,68 18,74 C22,66 34,70 32,80 C38,82 36,92 28,92 L10,92 C2,92 0,86 4,84 Z" />
          <Path d="M156,84 C158,74 148,68 142,74 C138,66 126,70 128,80 C122,82 124,92 132,92 L150,92 C158,92 160,86 156,84 Z" />
        </G>
      </G>
    ),
  },
  bunny_ears: {
    color: '#F9A8D4',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" transform="translate(0,6) translate(80,40) scale(0.85) translate(-80,-40)">
        <Path d="M56,40 C40,24 40,-8 52,-6 C66,-4 70,22 68,38 Z" fill="#FFFFFF" transform="rotate(-10 60 30)" />
        <Path d="M104,40 C120,24 120,-8 108,-6 C94,-4 90,22 92,38 Z" fill="#FFFFFF" transform="rotate(10 100 30)" />
        <Path d="M57,32 C48,20 48,2 54,2 C62,4 64,20 63,32 Z" fill="#F9A8D4" strokeWidth={0} transform="rotate(-10 60 30)" />
        <Path d="M103,32 C112,20 112,2 106,2 C98,4 96,20 97,32 Z" fill="#F9A8D4" strokeWidth={0} transform="rotate(10 100 30)" />
      </G>
    ),
  },

  // --- epic -----------------------------------------------------------------
  crab: {
    color: '#EF4444',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        <Path d="M54,136 L42,152 M60,140 L52,156 M106,136 L118,152 M100,140 L108,156" fill="none" strokeWidth={4} />
        <Path d="M50,138 C50,120 110,120 110,138 C110,150 50,150 50,138 Z" fill="#EF4444" />
        <Path d="M70,124 L68,112 M90,124 L92,112" fill="none" strokeWidth={3} />
        <Circle cx={68} cy={110} r={5} fill="#FFFFFF" />
        <Circle cx={92} cy={110} r={5} fill="#FFFFFF" />
        <Circle cx={69} cy={111} r={2.2} fill={OUTLINE} strokeWidth={0} />
        <Circle cx={93} cy={111} r={2.2} fill={OUTLINE} strokeWidth={0} />
        <Path d="M72,140 Q80,146 88,140" fill="none" strokeWidth={2} />
        <Band d="M50,132 C34,128 24,118 22,104" color="#EF4444" w={6} />
        <Band d="M110,132 C126,128 136,118 138,104" color="#EF4444" w={6} />
        <Path d="M22,104 C10,98 10,82 22,80 C18,88 22,94 28,96 C30,88 34,84 36,88 C36,98 30,104 22,104 Z" fill="#EF4444" />
        <Path d="M138,104 C150,98 150,82 138,80 C142,88 138,94 132,96 C130,88 126,84 124,88 C124,98 130,104 138,104 Z" fill="#EF4444" />
      </G>
    ),
  },
  wings: {
    color: '#BAE6FD',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
        {[0, 1].map((side) => (
          <G key={side} transform={side ? 'translate(160,0) scale(-1,1)' : undefined}>
            <Path d="M34,62 C12,46 0,58 2,72 C-2,82 6,88 14,86 C6,96 14,106 24,100 C20,112 30,116 38,104 Z" fill="#FFFFFF" />
            <Path d="M30,66 C18,62 10,66 8,72 M30,78 C20,78 14,84 14,86 M32,90 C26,94 24,98 24,100" fill="none" stroke="#93C5FD" strokeWidth={1.6} />
          </G>
        ))}
      </G>
    ),
  },
  flames: {
    color: '#F97316',
    art: () => (
      <G>
        {[100, 118, 136, 154, 172, 8, 26, 44, 62, 80].map((deg, i) => {
          const p = around(deg, 60);
          return <Flame key={deg} x={p.x} y={p.y} s={i % 2 ? 0.9 : 1.15} rotate={deg + 90} />;
        })}
      </G>
    ),
  },
  butterflies: {
    color: '#A78BFA',
    art: () => (
      <G>
        <Butterfly x={30} y={36} s={1.3} rotate={-20} wing="#A78BFA" spot="#F9A8D4" />
        <Butterfly x={136} y={46} s={1} rotate={18} wing="#38BDF8" spot="#FDE047" />
        <Butterfly x={132} y={128} s={1.2} rotate={10} wing="#FB923C" spot="#FDE047" />
        <Path d="M42,46 Q60,60 52,80 M122,56 Q110,70 118,84" stroke="#A78BFA" strokeWidth={1.5} strokeDasharray="2 4" fill="none" />
      </G>
    ),
  },
  snowflakes: {
    color: '#7DD3FC',
    art: () => (
      <G>
        <Snowflake x={26} y={40} r={14} />
        <Snowflake x={138} y={36} r={10} />
        <Snowflake x={142} y={122} r={13} />
        <Snowflake x={20} y={120} r={9} />
        <Snowflake x={98} y={150} r={6} />
        <Sparkle x={60} y={10} r={5} color="#E0F2FE" />
      </G>
    ),
  },
  treasure: {
    color: '#EAB308',
    art: () => (
      <G stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
        <Path d="M112,124 H152 V148 H112 Z" fill="#92400E" />
        <Path d="M112,124 C112,108 152,108 152,124 Z" fill="#B45309" />
        <Path d="M112,124 H152 M130,118 V132" stroke="#FACC15" strokeWidth={3} />
        <Rect x={127} y={126} width={6} height={7} rx={1} fill="#FACC15" strokeWidth={1.5} />
        <Coin x={14} y={140} />
        <Coin x={26} y={132} />
        <Coin x={22} y={146} />
        <Coin x={36} y={144} r={6} />
        <Gem x={20} y={116} color="#38BDF8" />
        <Gem x={132} y={100} s={0.8} color="#F472B6" />
        <Gem x={28} y={30} s={1.1} color="#4ADE80" />
        <Sparkle x={140} y={28} r={8} />
      </G>
    ),
  },
  planet: {
    color: '#8B5CF6',
    art: () => (
      <G>
        {/* the ring passes in front of the photo at the bottom */}
        <Path d="M6,96 C10,120 150,92 154,64" fill="none" stroke={OUTLINE} strokeWidth={11} strokeLinecap="round" />
        <Path d="M6,96 C10,120 150,92 154,64" fill="none" stroke="#C4B5FD" strokeWidth={6} strokeLinecap="round" />
        <Path d="M6,96 C10,120 150,92 154,64" fill="none" stroke="#FDE68A" strokeWidth={1.5} strokeDasharray="6 5" />
        <G stroke={OUTLINE} strokeWidth={2}>
          <Circle cx={136} cy={26} r={9} fill="#FBBF24" />
          <Circle cx={24} cy={30} r={5} fill="#F472B6" />
        </G>
        <Sparkle x={30} y={140} r={6} color="#FDE68A" />
        <Sparkle x={148} y={140} r={5} color="#FFFFFF" />
      </G>
    ),
  },
  cherry_blossom: {
    color: '#F9A8D4',
    art: () => (
      <G>
        <Band d="M-2,22 C20,26 34,20 50,10 M24,22 C30,32 28,40 22,48" color="#7C4A21" w={4} />
        <Flower x={50} y={10} r={10} color="#FBCFE8" middle="#F472B6" />
        <Flower x={30} y={20} r={8} color="#F9A8D4" middle="#DB2777" />
        <Flower x={22} y={48} r={9} color="#FBCFE8" middle="#F472B6" />
        <Flower x={8} y={34} r={6} color="#F9A8D4" middle="#DB2777" />
        {[
          [130, 40, 20],
          [146, 80, -30],
          [128, 140, 60],
          [40, 146, -10],
        ].map(([x, y, r]) => (
          <Path key={x} d="M0,-5 C4,-2 4,3 0,5 C-4,3 -4,-2 0,-5 Z" fill="#FBCFE8" stroke={OUTLINE} strokeWidth={1.2} transform={`translate(${x},${y}) rotate(${r}) scale(1.4)`} />
        ))}
      </G>
    ),
  },

  // --- legendary ------------------------------------------------------------
  // A pregnant seahorse: the photo is her round belly
  seahorse: {
    color: '#FB923C',
    art: () => (
      <G strokeLinejoin="round" strokeLinecap="round">
        {/* dorsal fin on her back */}
        <Path d="M18,62 C2,66 -2,88 10,102 L26,92 Z" fill="#FDE68A" stroke={OUTLINE} strokeWidth={2.2} />
        <Path d="M20,70 L6,74 M20,80 L4,86 M22,88 L10,96" stroke="#F59E0B" strokeWidth={1.6} />
        {/* back curving from the neck round to the tail */}
        <Band d="M98,26 C64,10 26,34 24,74 C22,104 40,124 62,132" color="#FB923C" w={14} />
        {[40, 30, 26, 26, 30].map((x, i) => (
          <Path key={i} d={`M${x - 6},${36 + i * 18} l-7,-3 l3,7 Z`} fill="#FDBA74" stroke={OUTLINE} strokeWidth={1.4} />
        ))}
        {/* curly tail */}
        <Band d="M62,132 C66,152 46,160 38,150 C30,140 44,134 46,142" color="#FB923C" w={9} />
        {/* head and long snout */}
        <Path d="M90,12 C102,2 122,8 122,22 C122,32 112,38 100,36 C92,34 86,24 90,12 Z" fill="#FB923C" stroke={OUTLINE} strokeWidth={3} />
        <Path d="M118,18 L146,22 C152,23 152,31 146,31 L118,32 Z" fill="#FB923C" stroke={OUTLINE} strokeWidth={3} />
        <Path d="M92,10 L88,3 L98,7 L100,2 L106,7" fill="#FDBA74" stroke={OUTLINE} strokeWidth={2} />
        <Circle cx={106} cy={20} r={4.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} />
        <Circle cx={107} cy={21} r={2.2} fill={OUTLINE} />
        <Ellipse cx={104} cy={30} rx={4} ry={2.2} fill="#FB7185" opacity={0.6} />
        {/* the baby on the way */}
        <Heart x={142} y={58} s={0.8} rotate={12} color="#FDA4AF" />
        <Circle cx={134} cy={44} r={3} fill="#FFFFFF" stroke="#7DD3FC" strokeWidth={1.5} />
        <Circle cx={146} cy={76} r={2} fill="#FFFFFF" stroke="#7DD3FC" strokeWidth={1.2} />
      </G>
    ),
  },
  // A black cat in a pink collar napping on top of the photo (it purrs in
  // the app, see PurringCat)
  cat_purr: {
    color: '#F9A8D4',
    art: () => <SleepyCat />,
  },
  ocho_peek: {
    color: '#A78BFA',
    art: () => (
      <G>
        <OchoPeekBody />
        <OchoPeekPupils />
      </G>
    ),
  },
  angler_glow: {
    color: '#0EA5E9',
    art: () => (
      <G>
        <AnglerBody />
        <AnglerLight />
      </G>
    ),
  },
  sea_turtle: {
    color: '#10B981',
    art: () => (
      <G strokeLinejoin="round" strokeLinecap="round" stroke={OUTLINE}>
        <G transform="rotate(-30 128 34)">
          <Path d="M110,30 C104,18 96,18 92,22 C100,24 104,28 108,34 Z M110,40 C104,50 96,52 92,48 C100,46 104,42 108,38 Z" fill="#6EE7B7" strokeWidth={2} />
          <Path d="M144,30 C150,22 156,22 158,26 C154,28 150,30 146,34 Z M144,40 C150,46 154,48 156,46 C152,42 148,40 146,38 Z" fill="#6EE7B7" strokeWidth={2} />
          <Ellipse cx={128} cy={35} rx={20} ry={14} fill="#10B981" strokeWidth={2.8} />
          <Path d="M118,28 L128,24 L138,28 L138,42 L128,46 L118,42 Z M128,24 V46 M118,35 H138" fill="none" stroke="#065F46" strokeWidth={1.6} />
          <Circle cx={104} cy={35} r={7} fill="#6EE7B7" strokeWidth={2.2} />
          <Circle cx={101} cy={33} r={1.6} fill={OUTLINE} strokeWidth={0} />
        </G>
        <G fill="#FFFFFF" strokeWidth={1.4} stroke="#7DD3FC">
          <Circle cx={90} cy={8} r={3} />
          <Circle cx={80} cy={2} r={2} />
          <Circle cx={30} cy={130} r={4} />
          <Circle cx={20} cy={116} r={2.5} />
        </G>
      </G>
    ),
  },
  dragon: {
    color: '#16A34A',
    art: () => (
      <G strokeLinejoin="round" strokeLinecap="round">
        <Band d="M120,26 C150,50 150,110 116,140 C84,166 36,154 20,122 C10,100 14,74 28,60" color="#22C55E" w={12} />
        {Array.from({ length: 9 }, (_, i) => {
          const p = around(-40 + i * 24, 70);
          return <Path key={i} d={`M${p.x},${p.y} l4,-6 l3,7 Z`} fill="#FDE047" stroke={OUTLINE} strokeWidth={1.2} transform={`rotate(${-40 + i * 24 + 90} ${p.x} ${p.y})`} />;
        })}
        <Path d="M28,60 C18,52 22,40 30,38 L26,30 L36,36" fill="#22C55E" stroke={OUTLINE} strokeWidth={2.2} />
        <Path d="M106,10 C118,4 134,10 136,22 C138,34 124,40 114,36 C104,32 100,18 106,10 Z" fill="#22C55E" stroke={OUTLINE} strokeWidth={3} />
        <Path d="M134,24 C144,22 154,26 156,32 C148,32 140,32 134,30 Z" fill="#22C55E" stroke={OUTLINE} strokeWidth={2.5} />
        <Path d="M110,12 L102,0 M120,8 L120,-4" stroke="#FDE047" strokeWidth={3} />
        <Path d="M150,28 C156,40 150,48 144,48 M148,32 C160,34 162,44 158,50" fill="none" stroke="#FDE047" strokeWidth={1.6} />
        <Circle cx={124} cy={20} r={4} fill="#FDE047" stroke={OUTLINE} strokeWidth={1.8} />
        <Circle cx={125} cy={20} r={1.8} fill={OUTLINE} />
      </G>
    ),
  },
  royal: {
    color: '#EAB308',
    art: () => <RoyalCrown />,
  },
  // two koi circling the photo, nose to tail
  koi: {
    color: '#F97316',
    art: () => (
      <G strokeLinejoin="round" strokeLinecap="round">
        {[
          { deg: -50, body: '#FB923C', spot: '#FFFFFF' },
          { deg: 130, body: '#FFFFFF', spot: '#F97316' },
        ].map(({ deg, body, spot }) => {
          const p = around(deg, 66);
          return (
            <G key={deg} transform={`translate(${p.x},${p.y}) rotate(${deg + 90})`} stroke={OUTLINE}>
              <Path d="M-16,0 L-29,-9 L-25,0 L-29,9 Z" fill={body} strokeWidth={2} />
              <Path d="M-4,-6 L-9,-13 L2,-8 Z M-4,6 L-9,13 L2,8 Z" fill={body} strokeWidth={1.6} />
              <Path d="M-18,0 C-10,-10 10,-10 20,0 C10,10 -10,10 -18,0 Z" fill={body} strokeWidth={2.4} />
              <Path d="M-6,-5 C-2,-8 4,-7 6,-3 C2,-2 -2,-2 -6,-5 Z M-12,2 C-10,5 -4,6 -2,4 C-6,2 -9,1 -12,2 Z" fill={spot} strokeWidth={0} />
              <Circle cx={13} cy={-2.5} r={1.8} fill={OUTLINE} strokeWidth={0} />
              <Path d="M19,1 Q23,3 24,7" fill="none" strokeWidth={1.2} />
            </G>
          );
        })}
        <G fill="#FFFFFF" stroke="#7DD3FC" strokeWidth={1.3}>
          <Circle cx={22} cy={30} r={3} />
          <Circle cx={140} cy={130} r={3} />
          <Circle cx={30} cy={20} r={2} />
        </G>
      </G>
    ),
  },
  jellyfish_crown: {
    color: '#C084FC',
    art: () => (
      <G>
        <JellyTentacles side="left" />
        <JellyTentacles side="right" />
        <JellyBell />
      </G>
    ),
  },
};

// --- the moving legendary frames -------------------------------------------

// A clock that runs 0 to 1 over and over
function useLoop(ms: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, ms]);
  return t;
}

// One drawing on its own animated layer; origin is in the frame's 160 units
function FrameLayer({ box, style, origin, children }: { box: number; style?: object; origin?: [number, number]; children: ReactElement }) {
  const k = box / 160;
  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, origin && { transformOrigin: [origin[0] * k, origin[1] * k, 0] }, style]}>
      <Svg width={box} height={box} viewBox="0 0 160 160">
        {children}
      </Svg>
    </Reanimated.View>
  );
}

// Ocho glances left, back, right and back again
function LiveOchoPeek({ box }: { box: number }) {
  const t = useLoop(4200);
  const k = box / 160;
  const eyes = useAnimatedStyle(() => {
    const p = t.value;
    // an eased step from 0 to 1 between a and b
    const ramp = (a: number, b: number) => {
      const v = Math.max(0, Math.min(1, (p - a) / (b - a)));
      return v * v * (3 - 2 * v);
    };
    // look left, back to the middle, look right, back again
    const x = -ramp(0.2, 0.27) + ramp(0.45, 0.52) + ramp(0.6, 0.67) - ramp(0.85, 0.92);
    return { transform: [{ translateX: x * 3 * k }] };
  });
  return (
    <>
      <FrameLayer box={box}>
        <OchoPeekBody />
      </FrameLayer>
      <FrameLayer box={box} style={eyes}>
        <OchoPeekPupils />
      </FrameLayer>
    </>
  );
}

// The lure flickers like a failing bulb
function LiveAnglerGlow({ box }: { box: number }) {
  const t = useLoop(3000);
  const light = useAnimatedStyle(() => {
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(t.value * Math.PI * 2 * 7));
    const dip = Math.sin(t.value * Math.PI * 2 * 1.7) < -0.8 ? 0.25 : 1;
    return { opacity: flick * dip };
  });
  return (
    <>
      <FrameLayer box={box}>
        <AnglerBody />
      </FrameLayer>
      <FrameLayer box={box} style={light}>
        <AnglerLight />
      </FrameLayer>
    </>
  );
}

// Each jewel catches the light in turn
function Glint({ box, t, i }: { box: number; t: SharedValue<number>; i: number }) {
  const g = ROYAL_GLINTS[i];
  const style = useAnimatedStyle(() => {
    const p = (t.value * 3 - i) % 3;
    const on = p > 0 && p < 0.6 ? Math.sin((p / 0.6) * Math.PI) : 0;
    return { opacity: on, transform: [{ scale: 0.4 + 0.8 * on }, { rotate: `${on * 45}deg` }] };
  });
  return (
    <FrameLayer box={box} style={style} origin={[g.x, g.y]}>
      <Sparkle x={g.x} y={g.y} r={g.r} color="#FFFFFF" />
    </FrameLayer>
  );
}

function LiveRoyal({ box }: { box: number }) {
  const t = useLoop(3600);
  return (
    <>
      <FrameLayer box={box}>
        <RoyalCrown />
      </FrameLayer>
      {ROYAL_GLINTS.map((_, i) => (
        <Glint key={i} box={box} t={t} i={i} />
      ))}
    </>
  );
}

// The tentacles drift back and forth under the bell
function LiveJellyCrown({ box }: { box: number }) {
  const t = useLoop(2800);
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.sin(t.value * Math.PI * 2) * 4}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.sin(t.value * Math.PI * 2 + 1.4) * -4}deg` }] }));
  return (
    <>
      <FrameLayer box={box} style={left} origin={[45, 36]}>
        <JellyTentacles side="left" />
      </FrameLayer>
      <FrameLayer box={box} style={right} origin={[115, 36]}>
        <JellyTentacles side="right" />
      </FrameLayer>
      <FrameLayer box={box}>
        <JellyBell />
      </FrameLayer>
    </>
  );
}

// Frames that move on profile-sized avatars
const LIVE: Record<string, (props: { box: number }) => ReactElement> = {
  cat_purr: PurringCat,
  ocho_peek: LiveOchoPeek,
  angler_glow: LiveAnglerGlow,
  royal: LiveRoyal,
  jellyfish_crown: LiveJellyCrown,
};

export const FRAME_DESIGNS = Object.keys(DESIGNS);

// The color of the ring around the avatar (plain frames are just a color)
export function frameColor(value: string | null | undefined) {
  if (!value) return '#7c3aed';
  // a plain color, or a design; anything else (a retired design) gets the default
  return DESIGNS[value]?.color ?? (value.startsWith('#') ? value : '#7c3aed');
}

// Draws a designed frame's decoration over an avatar of the given size.
// Put it inside a wrapper the same size as the avatar; plain colors draw nothing.
export default function FrameDecoration({ value, size }: { value: string | null | undefined; size: number }) {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const focused = useScreenFocused();
  const design = value ? DESIGNS[value] : undefined;
  if (!design) return null;
  const box = size * 1.6; // the 160-unit box, where the avatar is 100 units wide
  // legendary frames move on profile-sized avatars (small swatches stay still)
  const Live = value && size >= 60 && focused && settings.animations && !reduceMotion ? LIVE[value] : undefined;
  return (
    <View pointerEvents="none" style={[styles.overlay, { width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }]}>
      {Live ? (
        <Live key={value} box={box} />
      ) : (
        // keyed by design so switching frames redraws from scratch (a tilted
        // design's rotation would otherwise stick to the next one)
        <Svg key={value} width={box} height={box} viewBox="0 0 160 160">
          {design.art()}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
});

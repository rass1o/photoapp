import { ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group as SkGroup, Path as SkPath, Skia } from '@shopify/react-native-skia';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Legendary pets that sit beside your octopus. Same cartoon style as the
// octopus: chunky outline, simple shapes.

const OUTLINE = colors.abyss;
const GOLD = '#FBBF24';

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const dist = i % 2 === 0 ? r : r * 0.45;
    return `${(x + dist * Math.cos(angle)).toFixed(1)},${(y + dist * Math.sin(angle)).toFixed(1)}`;
  });
  return <Path d={`M${points.join(' L')} Z`} fill={GOLD} stroke={OUTLINE} strokeWidth={1.2} strokeLinejoin="round" />;
}

function Flower({ x, y, r, petal, center = '#FDE047' }: { x: number; y: number; r: number; petal: string; center?: string }) {
  return (
    <G stroke={OUTLINE} strokeWidth={1.3}>
      {[0, 72, 144, 216, 288].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        return <Circle key={deg} cx={x + r * Math.cos(a)} cy={y + r * Math.sin(a)} r={r * 0.75} fill={petal} />;
      })}
      <Circle cx={x} cy={y} r={r * 0.6} fill={center} />
    </G>
  );
}

// ---------------------------------------------------------------- cats

type CatLook = {
  fur: string;
  earInner: string;
  eyes: string;
  chest?: string; // bib, muzzle and socks, for tuxedo cats
  patches?: { orange: string; black: string }; // calico spots
};

const CATS: Record<'merlin' | 'tuxie' | 'ginger', CatLook> = {
  merlin: { fur: '#2A2533', earInner: '#F9A8D4', eyes: '#C6E35B' },
  tuxie: { fur: '#1F1D24', earInner: '#F9A8D4', eyes: '#7DD3FC', chest: '#FFFFFF' },
  ginger: { fur: '#FFFBF5', earInner: '#F9A8D4', eyes: '#F59E0B', patches: { orange: '#E8893A', black: '#2A2533' } },
};

function CatTail({ c }: { c: CatLook }) {
  return (
    <G strokeLinecap="round">
      <Path d="M70,88 C94,86 98,62 84,54" stroke={OUTLINE} strokeWidth={11} fill="none" />
      <Path d="M70,88 C94,86 98,62 84,54" stroke={c.patches ? c.patches.orange : c.fur} strokeWidth={6} fill="none" />
    </G>
  );
}

function CatPaw({ x, c }: { x: number; c: CatLook }) {
  return <Ellipse cx={x} cy={92} rx={7} ry={4.5} fill={c.chest ?? c.fur} stroke={OUTLINE} strokeWidth={2.5} />;
}

// paws: which front paws are drawn here ('none'/'left' when they move on their own)
function Cat({ c, paws = 'both' }: { c: CatLook; paws?: 'both' | 'left' | 'none' }) {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Ellipse cx={50} cy={72} rx={24} ry={22} fill={c.fur} />
      {c.chest && <Ellipse cx={50} cy={76} rx={12} ry={15} fill={c.chest} strokeWidth={0} />}
      {c.patches && (
        <G strokeWidth={0}>
          <Path d="M28,66 C30,56 40,54 44,62 C46,70 38,78 30,76 Z" fill={c.patches.orange} />
          <Path d="M58,84 C60,76 70,74 72,80 C72,88 64,92 58,90 Z" fill={c.patches.black} />
        </G>
      )}
      {paws !== 'none' && <Ellipse cx={41} cy={92} rx={7} ry={4.5} fill={c.chest ?? c.fur} />}
      {paws === 'both' && <Ellipse cx={59} cy={92} rx={7} ry={4.5} fill={c.chest ?? c.fur} />}
      <Path d="M32,32 L29,8 L47,22 Z" fill={c.patches ? c.patches.orange : c.fur} />
      <Path d="M68,32 L71,8 L53,22 Z" fill={c.patches ? c.patches.black : c.fur} />
      <Path d="M33,26 L32,15 L40,22 Z" fill={c.earInner} strokeWidth={0} />
      <Path d="M67,26 L68,15 L60,22 Z" fill={c.earInner} strokeWidth={0} />
      <Circle cx={50} cy={40} r={20} fill={c.fur} />
      {c.patches && (
        <G strokeWidth={0}>
          <Path d="M34,28 C38,22 46,21 49,22 C48,30 42,36 32,38 C31,34 32,31 34,28 Z" fill={c.patches.orange} />
          <Path d="M56,22 C62,22 67,26 69,32 C64,33 58,30 56,22 Z" fill={c.patches.black} />
        </G>
      )}
      {c.chest && <Ellipse cx={50} cy={49} rx={10} ry={7} fill={c.chest} strokeWidth={0} />}
    </G>
  );
}

function CatEyes({ eyes }: { eyes: string }) {
  return (
    <G>
      <Ellipse cx={42} cy={39} rx={5} ry={6} fill={eyes} />
      <Ellipse cx={58} cy={39} rx={5} ry={6} fill={eyes} />
    </G>
  );
}

// Nose, mouth and whiskers
function CatFace() {
  return (
    <G>
      <Path d="M47.5,46 L52.5,46 L50,49 Z" fill="#F9A8D4" />
      <Path d="M50,49 Q47,52 45,50 M50,49 Q53,52 55,50" stroke="#9CA3AF" strokeWidth={1.2} fill="none" />
      <Path d="M30,45 L40,47 M30,50 L40,49 M70,45 L60,47 M70,50 L60,49" stroke="#9CA3AF" strokeWidth={1} />
    </G>
  );
}

// Slit pupils, apart from the face so they can glance around
function CatPupils() {
  return (
    <G>
      <Ellipse cx={42} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
      <Ellipse cx={58} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
    </G>
  );
}

// Merlin: pink collar with a star tag, and a fish he caught
function MerlinExtras() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M34,56 Q50,64 66,56" stroke="#EC4899" strokeWidth={5} fill="none" />
      <Star x={50} y={66} r={5.5} />
    </G>
  );
}

// Held sideways in his mouth
function MerlinFish() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M36,51 C40,46 52,46 56,51 C52,56 40,56 36,51 Z" fill="#7DB7D8" strokeWidth={1.8} />
      <Path d="M56,51 L64,46 L63,56 Z" fill="#7DB7D8" strokeWidth={1.8} />
      <Path d="M44,48 Q46,51 44,54" stroke="#4B8FB3" strokeWidth={1.2} fill="none" />
      <Circle cx={40} cy={50.5} r={1.3} fill="#111" stroke="none" />
    </G>
  );
}

// Tuxie: a bowtie, and thick nerd glasses with tape on the bridge
function TuxieBowtie() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round">
      <Path d="M44,58 L36,53 L36,63 Z M56,58 L64,53 L64,63 Z" fill="#DC2626" strokeWidth={1.8} />
      <Circle cx={50} cy={58} r={3} fill="#B91C1C" strokeWidth={1.5} />
    </G>
  );
}

function TuxieGlasses() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round">
      <Rect x={34.5} y={32.5} width={15} height={13} rx={3} fill="#FFFFFF" fillOpacity={0.15} stroke="#111" strokeWidth={3} />
      <Rect x={50.5} y={32.5} width={15} height={13} rx={3} fill="#FFFFFF" fillOpacity={0.15} stroke="#111" strokeWidth={3} />
      <Rect x={48} y={35.5} width={4} height={4} fill="#F5F5F4" strokeWidth={1} />
      <Path d="M34.5,36 L28,34 M65.5,36 L72,34" stroke="#111" strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

// His foreleg, raised in front of his chest to push his glasses up
function TuxieLeg() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5}>
      <Rect x={54} y={66} width={10} height={40} rx={5} fill={colors.white} />
      <Path d="M56.5,69 L56.5,71.5 M59,68 L59,70.5 M61.5,69 L61.5,71.5" strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

// A glint that sweeps across glasses: three streaks lit one after another
const TUXIE_GLARE = ['M37,43 L41,35', 'M41,44 L46,34', 'M45,43 L48,37'];
const GIBSON_GLARE = ['M33,57 L37,50', 'M38,59 L43,50', 'M43,58 L46,51'];

function Glare({ streak, right }: { streak: string; right: number }) {
  return (
    <G stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" opacity={0.9}>
      <Path d={streak} />
      <Path d={streak} transform={`translate(${right}, 0)`} />
    </G>
  );
}

// Ginger: a flower tucked on top of her head
function GingerExtras() {
  return (
    <G>
      <Path d="M60,22 Q64,18 68,20 Q64,24 60,22 Z" fill="#4ADE80" stroke={OUTLINE} strokeWidth={1.3} />
      <Flower x={56} y={20} r={4.5} petal="#F472B6" />
    </G>
  );
}

// -------------------------------------------------------------- bassets

type BassetColors = {
  head: string;
  ears: string;
  body: string;
  muzzle: string;
  chest: string;
  paws: string;
  blaze: string | null; // white stripe up the forehead
};

// Susie is a classic tricolor; Scarlet is all dark brown and black
const BASSETS: Record<'susie' | 'scarlet', BassetColors> = {
  susie: {
    head: '#A0612B',
    ears: '#7A4520',
    body: '#231B17',
    muzzle: '#FFFFFF',
    chest: '#FFFFFF',
    paws: '#FFFFFF',
    blaze: '#FFFFFF',
  },
  scarlet: {
    head: '#4A2C1A',
    ears: '#2E1C12',
    body: '#1C1410',
    muzzle: '#6B4226',
    chest: '#5A3820',
    paws: '#5A3820',
    blaze: null,
  },
};

function BassetTail({ c }: { c: BassetColors }) {
  return (
    <G strokeLinecap="round">
      <Path d="M84,74 C98,66 100,52 95,44" stroke={OUTLINE} strokeWidth={10} fill="none" />
      <Path d="M84,74 C98,66 100,52 95,44" stroke={c.body} strokeWidth={5} fill="none" />
    </G>
  );
}

function BassetEar({ side, c }: { side: 'left' | 'right'; c: BassetColors }) {
  return side === 'left' ? (
    <Path d="M44,30 C28,33 22,74 32,88 C42,92 47,58 46,40 Z" fill={c.ears} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" />
  ) : (
    <Path d="M72,30 C88,33 94,74 84,88 C74,92 69,58 70,40 Z" fill={c.ears} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" />
  );
}

// ears: false when they're drawn on their own layers so they can flare
function Basset({ c, ears = true }: { c: BassetColors; ears?: boolean }) {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Ellipse cx={58} cy={74} rx={30} ry={20} fill={c.body} />
      <Ellipse cx={58} cy={80} rx={15} ry={13} fill={c.chest} strokeWidth={0} />
      <Ellipse cx={45} cy={93} rx={8} ry={4.5} fill={c.paws} />
      <Ellipse cx={71} cy={93} rx={8} ry={4.5} fill={c.paws} />
      <Ellipse cx={58} cy={42} rx={18} ry={20} fill={c.head} />
      {/* long droopy ears */}
      {ears && <BassetEar side="left" c={c} />}
      {ears && <BassetEar side="right" c={c} />}
      {c.blaze && <Path d="M58,24 C55,32 55,42 58,48 C61,42 61,32 58,24 Z" fill={c.blaze} strokeWidth={0} />}
      <Ellipse cx={58} cy={55} rx={12} ry={9} fill={c.muzzle} />
    </G>
  );
}

function BassetEyes() {
  return (
    <G>
      <Circle cx={51} cy={43} r={3} fill="#111" />
      <Circle cx={65} cy={43} r={3} fill="#111" />
    </G>
  );
}

// Lids, nose and mouth
function BassetFace() {
  return (
    <G>
      {/* droopy lids */}
      <Path d="M47,40 Q51,38 55,41 M61,41 Q65,38 69,40" stroke="#111" strokeWidth={1.5} fill="none" />
      <Ellipse cx={58} cy={51} rx={5} ry={3.5} fill="#2B1D16" />
      <Path d="M58,54 L58,57 Q55,60 52,58 M58,57 Q61,60 64,58" stroke="#2B1D16" strokeWidth={1.5} fill="none" />
    </G>
  );
}

// Stuck out now and then
function Tongue() {
  return (
    <G stroke={OUTLINE} strokeWidth={1.5} strokeLinejoin="round">
      <Path d="M53,57 Q52,69 58,69 Q64,69 63,57 Z" fill="#F472B6" />
      <Path d="M58,59 L58,65" stroke="#DB2777" strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

// Susie: a flower on top of each ear
function SusieFlower({ x }: { x: number }) {
  return <Flower x={x} y={30} r={5} petal="#FDA4AF" />;
}

// Scarlet: a big snapback, bill off to the side
function ScarletExtras() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round">
      <Path d="M70,28 C84,22 104,24 106,30 C98,34 80,34 70,32 Z" fill="#1D4ED8" />
      <Path d="M34,32 C32,4 84,4 82,32 Z" fill="#DC2626" />
      <Path d="M48,30 C48,14 68,14 68,30 Z" fill="#FFFFFF" strokeWidth={2} />
      <Star x={58} y={24} r={5} />
      <Path d="M32,32 Q58,38 84,32" stroke="#1D4ED8" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Circle cx={58} cy={10} r={3} fill="#DC2626" />
    </G>
  );
}

// ------------------------------------------------------------- the rest

// Mango: a flamingo on one leg in a pink cowboy hat, chewing on wheat.
// Body, neck and head are apart so she can bend down.
const MANGO_PINK = '#F9A8C9';
const MANGO_DEEP = '#EC6FA6';
const NECK_UP = 'M40,58 C26,52 30,40 40,38 C48,36 46,30 40,30';
const NECK_DOWN = 'M40,58 C30,60 22,68 24,74 C25,78 28,80 30,80';

function MangoBody() {
  const pink = MANGO_PINK;
  const deep = MANGO_DEEP;
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      {/* legs: one straight, one tucked */}
      <Path d="M50,70 L50,95 M44,96 L56,96" stroke={deep} strokeWidth={3} fill="none" />
      <Path d="M60,70 L68,82 L58,85" stroke={deep} strokeWidth={3} fill="none" />
      <Path d="M76,56 L92,52 L86,62 Z" fill={deep} />
      <Ellipse cx={58} cy={60} rx={23} ry={14} fill={pink} />
      <Path d="M52,58 C60,52 72,54 76,60 C68,66 58,66 52,58 Z" fill={deep} strokeWidth={2} />
    </G>
  );
}

function MangoNeck() {
  return (
    <G strokeLinecap="round">
      <Path d={NECK_UP} stroke={OUTLINE} strokeWidth={10} fill="none" />
      <Path d={NECK_UP} stroke={MANGO_PINK} strokeWidth={5} fill="none" />
    </G>
  );
}

function MangoHead() {
  const pink = MANGO_PINK;
  const deep = MANGO_DEEP;
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Circle cx={38} cy={26} r={10} fill={pink} />
      {/* beak bends down, black tip */}
      <Path d="M45,23 C52,23 56,27 55,34 C53,30 50,29 45,30 Z" fill="#FFF1E6" />
      <Path d="M55,34 C53,30 52,29.5 51,29.5 C53,27 55,29 55,34 Z" fill="#1F1D24" strokeWidth={1.5} />
      {/* cowboy hat */}
      <Path d="M18,14 Q20,22 38,21 Q56,22 58,14 Q48,18 38,18 Q28,18 18,14 Z" fill={deep} />
      <Path d="M27,18 C26,6 30,2 38,6 C46,2 50,6 49,18 Z" fill={pink} />
      <Path d="M27,15 Q38,18 49,15" stroke={deep} strokeWidth={2.5} fill="none" />
      <Star x={38} y={10.5} r={4} />
    </G>
  );
}

function MangoEye() {
  return <Circle cx={37} cy={24} r={2} fill="#111" />;
}

// Sticking out the side of Mango's beak
function MangoWheat() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M53,30 L72,22" stroke="#C99A2E" strokeWidth={1.8} fill="none" />
      <G fill="#E8B84A" strokeWidth={1.2}>
        <Ellipse cx={66} cy={22} rx={3.2} ry={1.6} rotation={-50} origin="66, 22" />
        <Ellipse cx={68} cy={26} rx={3.2} ry={1.6} rotation={30} origin="68, 26" />
        <Ellipse cx={71} cy={19} rx={3.2} ry={1.6} rotation={-50} origin="71, 19" />
        <Ellipse cx={73} cy={23} rx={3.2} ry={1.6} rotation={30} origin="73, 23" />
        <Ellipse cx={76} cy={20} rx={3.4} ry={1.6} rotation={-20} origin="76, 20" />
      </G>
    </G>
  );
}

// Leila: a little film camera come to life
function Leila() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      {/* arms and legs */}
      <Path d="M20,58 Q10,60 8,70" stroke={OUTLINE} strokeWidth={3} fill="none" />
      <Circle cx={8} cy={71} r={4} fill="#F5D0A9" />
      <Path d="M38,78 L36,92 M62,78 L64,92" stroke={OUTLINE} strokeWidth={3} fill="none" />
      <Ellipse cx={33} cy={94} rx={6} ry={3.5} fill="#E8664A" />
      <Ellipse cx={67} cy={94} rx={6} ry={3.5} fill="#E8664A" />
      {/* body: top plate, viewfinder, leather wrap */}
      <Rect x={22} y={18} width={9} height={6} rx={1.5} fill="#3F4756" />
      <Rect x={40} y={14} width={20} height={12} rx={3} fill="#3F4756" />
      <Rect x={18} y={24} width={64} height={56} rx={9} fill="#D9DEE5" />
      <Rect x={18} y={48} width={64} height={24} fill="#8B5A3C" strokeWidth={0} />
      <Path d="M18,48 L82,48 M18,72 L82,72" />
      <Circle cx={71} cy={31} r={3.5} fill="#FDE68A" strokeWidth={1.8} />
      {/* big lens */}
      <Circle cx={50} cy={60} r={14} fill="#3F4756" />
      <Circle cx={50} cy={60} r={8.5} fill="#1E293B" />
      <Circle cx={46.5} cy={56.5} r={2.5} fill="#FFFFFF" opacity={0.75} stroke="none" />
      {/* face on the top half */}
      <Path d="M46,42 Q50,45 54,42" strokeWidth={2} fill="none" />
      <Ellipse cx={31} cy={42} rx={3.5} ry={2} fill="#FB7185" opacity={0.6} stroke="none" />
      <Ellipse cx={69} cy={42} rx={3.5} ry={2} fill="#FB7185" opacity={0.6} stroke="none" />
    </G>
  );
}

function LeilaEyeWhites() {
  return (
    <G stroke={OUTLINE} strokeWidth={1.8}>
      <Ellipse cx={39} cy={36} rx={4.5} ry={5.5} fill="#FFFFFF" />
      <Ellipse cx={61} cy={36} rx={4.5} ry={5.5} fill="#FFFFFF" />
    </G>
  );
}

function LeilaPupils() {
  return (
    <G>
      <Circle cx={40} cy={37} r={2.4} fill="#111" />
      <Circle cx={62} cy={37} r={2.4} fill="#111" />
    </G>
  );
}

// Her waving arm, on its own so it can move
function LeilaArm() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M80,58 Q90,56 92,46" strokeWidth={3} fill="none" />
      <Circle cx={92} cy={45} r={4} fill="#F5D0A9" />
    </G>
  );
}

// A pop of light from her flash
function LeilaFlash() {
  return (
    <G>
      <Path
        d="M71,17 L74,27 L84,25 L76,31 L83,39 L73,35 L71,45 L68,35 L58,39 L65,31 L57,25 L67,27 Z"
        fill="#FEF9C3"
        stroke="#FDE047"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx={71} cy={31} r={5} fill={colors.white} />
    </G>
  );
}

// Gibson: a round tan hamster in sunglasses
function Gibson() {
  const fur = '#D9A066';
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Circle cx={30} cy={36} r={8} fill={fur} />
      <Circle cx={70} cy={36} r={8} fill={fur} />
      <Circle cx={30} cy={36} r={4} fill="#F9A8D4" strokeWidth={0} />
      <Circle cx={70} cy={36} r={4} fill="#F9A8D4" strokeWidth={0} />
      <Ellipse cx={36} cy={93} rx={7} ry={4} fill="#F5C6A5" />
      <Ellipse cx={64} cy={93} rx={7} ry={4} fill="#F5C6A5" />
      <Ellipse cx={50} cy={64} rx={32} ry={30} fill={fur} />
      <Ellipse cx={50} cy={74} rx={20} ry={18} fill="#F7E3C4" strokeWidth={0} />
      <Ellipse cx={30} cy={64} rx={6} ry={4} fill="#FB7185" opacity={0.45} strokeWidth={0} />
      <Ellipse cx={70} cy={64} rx={6} ry={4} fill="#FB7185" opacity={0.45} strokeWidth={0} />
      <Path d="M36,84 Q40,78 44,84 Z M56,84 Q60,78 64,84 Z" fill="#F5C6A5" strokeWidth={1.8} />
      <Path d="M47,62 L53,62 L50,65 Z" fill="#F472B6" strokeWidth={1.5} />
      <Path d="M50,65 Q47,69 44,67 M50,65 Q53,69 56,67" strokeWidth={1.5} fill="none" />
      <Rect x={47.5} y={67.5} width={5} height={4} rx={1} fill="#FFFFFF" strokeWidth={1.2} />
    </G>
  );
}

// Under the sunglasses, seen when he lifts them to wink
function GibsonEye({ x }: { x: number }) {
  return (
    <G>
      <Circle cx={x} cy={54} r={3.6} fill="#111" />
      <Circle cx={x + 1.2} cy={52.8} r={1.1} fill={colors.white} />
    </G>
  );
}

function GibsonGlasses() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M28,50 L72,50" strokeWidth={3} />
      <Path d="M30,49 L48,49 Q48,60 39,60 Q30,60 30,49 Z" fill="#111827" />
      <Path d="M52,49 L70,49 Q70,60 61,60 Q52,60 52,49 Z" fill="#111827" />
      <Path d="M34,52 L38,52 M56,52 L60,52" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.7} />
    </G>
  );
}

export const PET_NAMES: Record<string, string> = {
  merlin: 'Merlin',
  susie: 'Susie',
  scarlet: 'Scarlet',
  mango: 'Mango',
  leila: 'Leila',
  gibson: 'Gibson',
  tuxie: 'Tuxie',
  ginger: 'Ginger',
};

const CAT_KINDS = ['merlin', 'tuxie', 'ginger'] as const;
const BASSET_KINDS = ['susie', 'scarlet'] as const;
type CatKind = (typeof CAT_KINDS)[number];
type BassetKind = (typeof BASSET_KINDS)[number];
const isCat = (k: string): k is CatKind => (CAT_KINDS as readonly string[]).includes(k);
const isBasset = (k: string): k is BassetKind => (BASSET_KINDS as readonly string[]).includes(k);

// The whole pet in one drawing, for previews and tiles
function Still({ kind }: { kind: string }) {
  if (isCat(kind)) {
    const c = CATS[kind];
    return (
      <G>
        <CatTail c={c} />
        <Cat c={c} />
        <CatFace />
        <CatEyes eyes={c.eyes} />
        <CatPupils />
        {kind === 'merlin' && <MerlinExtras />}
        {kind === 'merlin' && <MerlinFish />}
        {kind === 'tuxie' && <TuxieBowtie />}
        {kind === 'tuxie' && <TuxieGlasses />}
        {kind === 'ginger' && <GingerExtras />}
      </G>
    );
  }
  if (isBasset(kind)) {
    return (
      <G>
        <BassetTail c={BASSETS[kind]} />
        <Basset c={BASSETS[kind]} />
        <BassetFace />
        <BassetEyes />
        {kind === 'susie' ? (
          <G>
            <SusieFlower x={40} />
            <SusieFlower x={76} />
          </G>
        ) : (
          <ScarletExtras />
        )}
      </G>
    );
  }
  if (kind === 'mango') {
    return (
      <G>
        <MangoBody />
        <MangoNeck />
        <MangoHead />
        <MangoEye />
        <MangoWheat />
      </G>
    );
  }
  if (kind === 'leila') {
    return (
      <G>
        <Leila />
        <LeilaEyeWhites />
        <LeilaPupils />
        <LeilaArm />
      </G>
    );
  }
  if (kind === 'gibson') {
    return (
      <G>
        <Gibson />
        <GibsonEye x={39} />
        <GibsonEye x={61} />
        <GibsonGlasses />
      </G>
    );
  }
  return null;
}

// ------------------------------------------------------------- animated
//
// Each moving part is its own still drawing on a layer, and the layers move
// with Reanimated transforms on the UI thread. Mango's neck is the one part
// that has to bend, so it's drawn with Skia.

type Frame = { size: number; vbW: number; s: number; offY: number };
type LiveProps = { frame: Frame; active: boolean };

const ease = Easing.inOut(Easing.sin);
const to = (toValue: number, duration: number, easing = ease) => withTiming(toValue, { duration, easing });
const snap = (toValue: number) => withTiming(toValue, { duration: 0 });

// A part on its own layer; origin (in drawing units) is what it turns around
function Layer({
  frame,
  origin,
  style,
  children,
}: {
  frame: Frame;
  origin?: [number, number];
  style?: object;
  children: ReactNode;
}) {
  const { size, vbW, s, offY } = frame;
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, origin && { transformOrigin: [origin[0] * s, origin[1] * s + offY, 0] }, style]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${vbW} 100`}>
        {children}
      </Svg>
    </Reanimated.View>
  );
}

// What every pet shares: breathing, the tail/flower sway, blinking and
// glancing around. Resets everything (the pet's own values too) to rest
// when it stops.
function useBase(active: boolean, own: SharedValue<number>[]) {
  const breathe = useSharedValue(0);
  const sway = useSharedValue(0);
  const blink = useSharedValue(0);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    breathe.value = withRepeat(to(1, 1500), -1, true);
    sway.value = withSequence(to(1, 550), withRepeat(withSequence(to(-1, 1100), to(1, 1100)), -1));

    let blinkTimer: ReturnType<typeof setTimeout>;
    const blinkLater = () => {
      blinkTimer = setTimeout(() => {
        blink.value = withSequence(to(1, 70), withDelay(70, to(0, 100)));
        blinkLater();
      }, 2200 + Math.random() * 3800);
    };
    blinkLater();

    let lookTimer: ReturnType<typeof setTimeout>;
    const lookLater = () => {
      lookTimer = setTimeout(() => {
        const x = Math.random() < 0.5 ? -1 : 1;
        const y = Math.random() * 1.2 - 0.6;
        lookX.value = withSequence(to(x, 240), withDelay(900, to(-x * 0.6, 320)), withDelay(500, to(0, 260)));
        lookY.value = withSequence(to(y, 240), withDelay(900, to(0, 320)));
        lookLater();
      }, 3000 + Math.random() * 4000);
    };
    lookLater();

    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(lookTimer);
      [breathe, sway, blink, lookX, lookY, ...own].forEach((v) => {
        cancelAnimation(v);
        v.value = 0;
      });
    };
    // shared values never change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { breathe, sway, blink, lookX, lookY };
}

type Base = ReturnType<typeof useBase>;

// Eyes blink by squashing flat; pupils glance up to reach[x, y] drawing units
function useEyes(base: Base, frame: Frame, reach: [number, number]) {
  const { s } = frame;
  const { blink, lookX, lookY } = base;
  const lids = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.9 * blink.value }] }));
  const pupils = useAnimatedStyle(() => ({
    transform: [
      { translateX: lookX.value * reach[0] * s },
      { translateY: lookY.value * reach[1] * s },
      { scaleY: 1 - 0.9 * blink.value },
    ],
  }));
  return { lids, pupils };
}

// Every few seconds, run the pet's next move (it returns how long it takes)
function useEvery(active: boolean, run: () => number) {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = (wait: number) => {
      timer = setTimeout(() => {
        if (!alive) return;
        next(runRef.current() + 1800 + Math.random() * 3200);
      }, wait);
    };
    next(1200 + Math.random() * 2500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active]);
}

// The whole pet: breathes from the feet, and can tilt its head back
function Body({
  frame,
  breathe,
  tilt,
  children,
}: {
  frame: Frame;
  breathe: SharedValue<number>;
  tilt?: SharedValue<number>;
  children: ReactNode;
}) {
  const { size, s, offY } = frame;
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(tilt ? tilt.value : 0) * -4}deg` }, { scaleY: 1 + 0.035 * breathe.value }],
  }));
  return (
    <Reanimated.View style={[{ width: size, height: size, transformOrigin: [size / 2, 96 * s + offY, 0] }, style]}>
      {children}
    </Reanimated.View>
  );
}

function useTail(sway: SharedValue<number>, deg: number) {
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value * deg}deg` }] }));
}

// A glint across glasses: three streaks lit one after another as p goes 0 -> 1
function GlareLayers({ frame, p, streaks, right }: { frame: Frame; p: SharedValue<number>; streaks: string[]; right: number }) {
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.2, 0.4], [0, 1, 0], 'clamp') }));
  const b = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.25, 0.45, 0.65], [0, 1, 0], 'clamp') }));
  const c = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.5, 0.7, 0.9], [0, 1, 0], 'clamp') }));
  return (
    <>
      {[a, b, c].map((style, i) => (
        <Layer key={i} frame={frame} style={style}>
          <Glare streak={streaks[i]} right={right} />
        </Layer>
      ))}
    </>
  );
}

const sweep = (p: SharedValue<number>) => {
  p.value = withSequence(to(1, 650, Easing.linear), snap(0));
  return 700;
};

// Merlin drops his fish, scoops it up in both paws and pops it back in
function MerlinLive({ frame, active }: LiveProps) {
  const c = CATS.merlin;
  const drop = useSharedValue(0);
  const grab = useSharedValue(0);
  const lift = useSharedValue(0);
  const base = useBase(active, [drop, grab, lift]);
  const { breathe, sway } = base;
  const eyes = useEyes(base, frame, [2.2, 1.5]);
  const { s } = frame;

  useEvery(active, () => {
    drop.value = withSequence(withTiming(1, { duration: 650, easing: Easing.bounce }), withDelay(500, to(0, 500)));
    grab.value = withSequence(withDelay(950, to(1, 200)), withDelay(600, to(0, 150)));
    lift.value = withSequence(withDelay(1150, to(1, 500)), withDelay(350, to(0, 450)));
    return 2500;
  });

  const tail = useTail(sway, 9);
  const fish = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value * 37 * s }, { rotate: `${drop.value * 12}deg` }],
  }));
  const pawL = useAnimatedStyle(() => ({
    transform: [{ translateX: grab.value * 5 * s }, { translateY: -lift.value * 36 * s }],
  }));
  const pawR = useAnimatedStyle(() => ({
    transform: [{ translateX: -grab.value * 5 * s }, { translateY: -lift.value * 36 * s }],
  }));

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame} origin={[70, 88]} style={tail}>
        <CatTail c={c} />
      </Layer>
      <Layer frame={frame}>
        <Cat c={c} paws="none" />
        <CatFace />
        <MerlinExtras />
      </Layer>
      <Layer frame={frame} origin={[50, 39]} style={eyes.lids}>
        <CatEyes eyes={c.eyes} />
      </Layer>
      <Layer frame={frame} origin={[50, 39.5]} style={eyes.pupils}>
        <CatPupils />
      </Layer>
      <Layer frame={frame} origin={[50, 51]} style={fish}>
        <MerlinFish />
      </Layer>
      <Layer frame={frame} style={pawL}>
        <CatPaw x={41} c={c} />
      </Layer>
      <Layer frame={frame} style={pawR}>
        <CatPaw x={59} c={c} />
      </Layer>
    </Body>
  );
}

// Tuxie's glasses glint, and now and then he pushes them up with a paw
function TuxieLive({ frame, active }: LiveProps) {
  const c = CATS.tuxie;
  const glare = useSharedValue(0);
  const leg = useSharedValue(0);
  const push = useSharedValue(0);
  const base = useBase(active, [glare, leg, push]);
  const { breathe, sway } = base;
  const eyes = useEyes(base, frame, [2.2, 1.5]);
  const { s } = frame;

  useEvery(active, () => {
    if (Math.random() < 0.45) return sweep(glare);
    leg.value = withSequence(to(1, 450), withDelay(700, to(0, 400)));
    push.value = withDelay(450, withSequence(to(1, 120), to(0, 160), to(1, 120), to(0, 160)));
    return 1600;
  });

  const tail = useTail(sway, 9);
  const glasses = useAnimatedStyle(() => ({ transform: [{ translateY: -push.value * 3 * s }] }));
  const restingPaw = useAnimatedStyle(() => ({ opacity: leg.value > 0.01 ? 0 : 1 }));
  const raisedLeg = useAnimatedStyle(() => ({
    opacity: leg.value > 0.01 ? 1 : 0,
    transform: [{ translateX: -5 * leg.value * s }, { translateY: -28 * leg.value * s }, { rotate: `${-16 * leg.value}deg` }],
  }));

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame} origin={[70, 88]} style={tail}>
        <CatTail c={c} />
      </Layer>
      <Layer frame={frame}>
        <Cat c={c} paws="left" />
        <CatFace />
        <TuxieBowtie />
      </Layer>
      <Layer frame={frame} origin={[50, 39]} style={eyes.lids}>
        <CatEyes eyes={c.eyes} />
      </Layer>
      <Layer frame={frame} origin={[50, 39.5]} style={eyes.pupils}>
        <CatPupils />
      </Layer>
      <Layer frame={frame} style={restingPaw}>
        <CatPaw x={59} c={c} />
      </Layer>
      <Layer frame={frame} style={glasses}>
        <TuxieGlasses />
      </Layer>
      <GlareLayers frame={frame} p={glare} streaks={TUXIE_GLARE} right={16} />
      <Layer frame={frame} origin={[59, 100]} style={raisedLeg}>
        <TuxieLeg />
      </Layer>
    </Body>
  );
}

// Ginger's flower bobs, sways and twirls, and she looks up at it
function GingerLive({ frame, active }: LiveProps) {
  const c = CATS.ginger;
  const spin = useSharedValue(0);
  const bounce = useSharedValue(0);
  const look = useSharedValue(0);
  const base = useBase(active, [spin, bounce, look]);
  const { breathe, sway, blink, lookX, lookY } = base;
  const eyes = useEyes(base, frame, [2.2, 1.5]);
  const { s } = frame;

  useEvery(active, () => {
    if (Math.random() < 0.5) {
      look.value = withSequence(to(1, 350), withDelay(1000, to(0, 400)));
      bounce.value = withDelay(350, withSequence(to(1, 200), to(0, 300), to(1, 200), to(0, 300)));
      return 1800;
    }
    spin.value = withSequence(to(1, 900, Easing.inOut(Easing.cubic)), snap(0));
    bounce.value = withSequence(to(1, 250), to(0, 350));
    return 1000;
  });

  const tail = useTail(sway, 9);
  const flower = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * 22 + spin.value * 360}deg` }, { scale: 1 + 0.25 * bounce.value }],
  }));
  // looking up at her flower, on top of the usual glancing around
  const pupils = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1.5 * look.value + 2.2 * lookX.value) * s },
      { translateY: (-3.5 * look.value + 1.5 * lookY.value) * s },
      { scaleY: 1 - 0.9 * blink.value },
    ],
  }));

  return (
    <Body frame={frame} breathe={breathe} tilt={look}>
      <Layer frame={frame} origin={[70, 88]} style={tail}>
        <CatTail c={c} />
      </Layer>
      <Layer frame={frame}>
        <Cat c={c} />
        <CatFace />
      </Layer>
      <Layer frame={frame} origin={[50, 39]} style={eyes.lids}>
        <CatEyes eyes={c.eyes} />
      </Layer>
      <Layer frame={frame} origin={[50, 39.5]} style={pupils}>
        <CatPupils />
      </Layer>
      <Layer frame={frame} origin={[57, 25]} style={flower}>
        <GingerExtras />
      </Layer>
    </Body>
  );
}

// Tongue out for a moment, wiggling
function useTongue(tongue: SharedValue<number>, sway: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: tongue.value > 0.02 ? 1 : 0,
    transform: [{ rotate: `${sway.value * 6}deg` }, { scaleY: tongue.value }],
  }));
}
const tongueOut = (tongue: SharedValue<number>) => {
  tongue.value = withSequence(to(1, 250), withDelay(1000, to(0, 250)));
  return 1600;
};

// Susie sticks her tongue out, and her ears flare up and out
function SusieLive({ frame, active }: LiveProps) {
  const c = BASSETS.susie;
  const tongue = useSharedValue(0);
  const ears = useSharedValue(0);
  const base = useBase(active, [tongue, ears]);
  const { breathe, sway } = base;
  const eyes = useEyes(base, frame, [1.6, 1]);

  useEvery(active, () => {
    if (Math.random() < 0.5) return tongueOut(tongue);
    ears.value = withSequence(withSpring(1, { damping: 6, stiffness: 140 }), withDelay(700, to(0, 450)));
    return 1900;
  });

  const tail = useTail(sway, 12);
  const earL = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ears.value * 20}deg` }, { scale: 1 + 0.2 * ears.value }],
  }));
  const earR = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ears.value * -20}deg` }, { scale: 1 + 0.2 * ears.value }],
  }));
  const tongueStyle = useTongue(tongue, sway);

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame} origin={[84, 74]} style={tail}>
        <BassetTail c={c} />
      </Layer>
      <Layer frame={frame}>
        <Basset c={c} ears={false} />
        <BassetFace />
      </Layer>
      <Layer frame={frame} origin={[58, 43]} style={eyes.pupils}>
        <BassetEyes />
      </Layer>
      <Layer frame={frame} origin={[44, 32]} style={earL}>
        <BassetEar side="left" c={c} />
        <SusieFlower x={40} />
      </Layer>
      <Layer frame={frame} origin={[72, 32]} style={earR}>
        <BassetEar side="right" c={c} />
        <SusieFlower x={76} />
      </Layer>
      <Layer frame={frame} origin={[58, 57]} style={tongueStyle}>
        <Tongue />
      </Layer>
    </Body>
  );
}

// Scarlet flips her cap into the air and catches it on her head
function ScarletLive({ frame, active }: LiveProps) {
  const c = BASSETS.scarlet;
  const tongue = useSharedValue(0);
  const hat = useSharedValue(0);
  const land = useSharedValue(0);
  const base = useBase(active, [tongue, hat, land]);
  const { breathe, sway } = base;
  const eyes = useEyes(base, frame, [1.6, 1]);
  const { s } = frame;

  useEvery(active, () => {
    if (Math.random() < 0.5) return tongueOut(tongue);
    hat.value = withSequence(to(1, 900, Easing.inOut(Easing.quad)), snap(0));
    land.value = withDelay(900, withSequence(to(1, 90), withSpring(0, { damping: 5, stiffness: 200 })));
    return 1500;
  });

  const tail = useTail(sway, 12);
  const hatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(hat.value, [0, 0.5, 1], [0, -26, 0]) * s },
      { rotate: `${hat.value * 360}deg` },
      { scaleY: 1 - 0.2 * land.value },
    ],
  }));
  const tongueStyle = useTongue(tongue, sway);

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame} origin={[84, 74]} style={tail}>
        <BassetTail c={c} />
      </Layer>
      <Layer frame={frame}>
        <Basset c={c} />
        <BassetFace />
      </Layer>
      <Layer frame={frame} origin={[58, 43]} style={eyes.pupils}>
        <BassetEyes />
      </Layer>
      <Layer frame={frame} origin={[58, 57]} style={tongueStyle}>
        <Tongue />
      </Layer>
      <Layer frame={frame} origin={[58, 22]} style={hatStyle}>
        <ScarletExtras />
      </Layer>
    </Body>
  );
}

const NECK_UP_POINTS = (NECK_UP.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const NECK_DOWN_POINTS = (NECK_DOWN.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

// Mango's neck, bending from upright down to the ground as dip goes 0 -> 1
function BendingNeck({ frame, dip }: { frame: Frame; dip: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const k = dip.value;
    const p = NECK_UP_POINTS.map((v, i) => v + (NECK_DOWN_POINTS[i] - v) * k);
    return Skia.PathBuilder.Make()
      .moveTo(p[0], p[1])
      .cubicTo(p[2], p[3], p[4], p[5], p[6], p[7])
      .cubicTo(p[8], p[9], p[10], p[11], p[12], p[13])
      .build();
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width: frame.size, height: frame.size }}>
        <SkGroup transform={[{ translateY: frame.offY }, { scale: frame.s }]}>
          <SkPath path={path} style="stroke" strokeWidth={10} strokeCap="round" color={OUTLINE} />
          <SkPath path={path} style="stroke" strokeWidth={5} strokeCap="round" color={MANGO_PINK} />
        </SkGroup>
      </Canvas>
    </View>
  );
}

// Mango drops her wheat, bends her neck all the way down and picks it up
function MangoLive({ frame, active }: LiveProps) {
  const dip = useSharedValue(0);
  const drop = useSharedValue(0);
  const loose = useSharedValue(0); // 1 while the wheat is out of her beak
  const { breathe, blink, lookX, lookY } = useBase(active, [dip, drop, loose]);
  const { s } = frame;

  useEvery(active, () => {
    loose.value = withSequence(snap(1), withDelay(1550, snap(0)));
    drop.value = withSequence(withTiming(1, { duration: 700, easing: Easing.bounce }), withDelay(850, snap(0)));
    dip.value = withSequence(withDelay(1000, to(1, 550)), withDelay(200, to(0, 600)));
    return 2400;
  });

  const head = useAnimatedStyle(() => ({
    transform: [{ translateX: -8 * dip.value * s }, { translateY: 52 * dip.value * s }, { rotate: `${70 * dip.value}deg` }],
  }));
  // moves with her head, then blinks and glances around its own middle
  // (the eye sits 1 left and 2 up from where the head turns)
  const eye = useAnimatedStyle(() => ({
    transform: [
      { translateX: -8 * dip.value * s },
      { translateY: 52 * dip.value * s },
      { rotate: `${70 * dip.value}deg` },
      { translateX: (-1 + 0.8 * lookX.value) * s },
      { translateY: (-2 + 0.6 * lookY.value) * s },
      { scaleY: 1 - 0.9 * blink.value },
      { translateX: 1 * s },
      { translateY: 2 * s },
    ],
  }));
  const heldWheat = useAnimatedStyle(() => ({
    opacity: 1 - loose.value,
    transform: [{ translateX: -8 * dip.value * s }, { translateY: 52 * dip.value * s }, { rotate: `${70 * dip.value}deg` }],
  }));
  const fallingWheat = useAnimatedStyle(() => ({
    opacity: loose.value,
    transform: [{ translateX: -28 * drop.value * s }, { translateY: 66 * drop.value * s }, { rotate: `${-20 * drop.value}deg` }],
  }));

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame}>
        <MangoBody />
      </Layer>
      <BendingNeck frame={frame} dip={dip} />
      <Layer frame={frame} origin={[38, 26]} style={heldWheat}>
        <MangoWheat />
      </Layer>
      <Layer frame={frame} origin={[38, 26]} style={head}>
        <MangoHead />
      </Layer>
      <Layer frame={frame} origin={[38, 26]} style={eye}>
        <MangoEye />
      </Layer>
      <Layer frame={frame} origin={[64, 25]} style={fallingWheat}>
        <MangoWheat />
      </Layer>
    </Body>
  );
}

// Leila waves and pops her flash
function LeilaLive({ frame, active }: LiveProps) {
  const flash = useSharedValue(0);
  const base = useBase(active, [flash]);
  const { breathe, sway } = base;
  const eyes = useEyes(base, frame, [1.6, 1.2]);

  useEvery(active, () => {
    flash.value = withSequence(to(1, 450), snap(0));
    return 500;
  });

  const arm = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value * 22}deg` }] }));
  const burst = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [{ scale: 0.3 + 1.5 * flash.value }],
  }));

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame} origin={[80, 58]} style={arm}>
        <LeilaArm />
      </Layer>
      <Layer frame={frame}>
        <Leila />
      </Layer>
      <Layer frame={frame} origin={[50, 36]} style={eyes.lids}>
        <LeilaEyeWhites />
      </Layer>
      <Layer frame={frame} origin={[50, 36.5]} style={eyes.pupils}>
        <LeilaPupils />
      </Layer>
      <Layer frame={frame} origin={[71, 31]} style={burst}>
        <LeilaFlash />
      </Layer>
    </Body>
  );
}

// Gibson's shades glint, then he lifts them and winks
function GibsonLive({ frame, active }: LiveProps) {
  const glare = useSharedValue(0);
  const raise = useSharedValue(0);
  const wink = useSharedValue(0);
  const base = useBase(active, [glare, raise, wink]);
  const { breathe, blink, lookX, lookY } = base;
  const eyes = useEyes(base, frame, [1.4, 1]);
  const { s } = frame;

  useEvery(active, () => {
    sweep(glare);
    raise.value = withDelay(700, withSequence(to(1, 300), withDelay(1000, to(0, 300))));
    wink.value = withDelay(1150, withSequence(to(1, 110), withDelay(220, to(0, 150))));
    return 2400;
  });

  const glasses = useAnimatedStyle(() => ({ transform: [{ translateY: -16 * raise.value * s }] }));
  const winking = useAnimatedStyle(() => ({
    transform: [
      { translateX: lookX.value * 1.4 * s },
      { translateY: lookY.value * s },
      { scaleY: 1 - 0.9 * Math.max(wink.value, blink.value) },
    ],
  }));

  return (
    <Body frame={frame} breathe={breathe}>
      <Layer frame={frame}>
        <Gibson />
      </Layer>
      <Layer frame={frame} origin={[39, 54]} style={eyes.pupils}>
        <GibsonEye x={39} />
      </Layer>
      <Layer frame={frame} origin={[61, 54]} style={winking}>
        <GibsonEye x={61} />
      </Layer>
      <Layer frame={frame} style={glasses}>
        <GibsonGlasses />
      </Layer>
      <GlareLayers frame={frame} p={glare} streaks={GIBSON_GLARE} right={22} />
    </Body>
  );
}

const LIVE: Record<string, (props: LiveProps) => ReactNode> = {
  merlin: MerlinLive,
  tuxie: TuxieLive,
  ginger: GingerLive,
  susie: SusieLive,
  scarlet: ScarletLive,
  mango: MangoLive,
  leila: LeilaLive,
  gibson: GibsonLive,
};

type Props = { kind: string; size?: number; animated?: boolean };

export default function Sidekick({ kind, size = 60, animated = false }: Props) {
  const reduceMotion = useReducedMotion();
  const vbW = isBasset(kind) ? 116 : 100;
  const Live = LIVE[kind];
  if (!Live) return null;

  if (!animated) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${vbW} 100`}>
        <Still kind={kind} />
      </Svg>
    );
  }

  // The drawing is fit to the width and centered top to bottom
  const s = size / vbW;
  const frame: Frame = { size, vbW, s, offY: (size - 100 * s) / 2 };
  return <Live frame={frame} active={!reduceMotion} />;
}

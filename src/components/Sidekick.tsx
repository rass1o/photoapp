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

function Cat({ c }: { c: CatLook }) {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M70,88 C94,86 98,62 84,54" stroke={OUTLINE} strokeWidth={11} fill="none" />
      <Path d="M70,88 C94,86 98,62 84,54" stroke={c.patches ? c.patches.orange : c.fur} strokeWidth={6} fill="none" />
      <Ellipse cx={50} cy={72} rx={24} ry={22} fill={c.fur} />
      {c.chest && <Ellipse cx={50} cy={76} rx={12} ry={15} fill={c.chest} strokeWidth={0} />}
      {c.patches && (
        <G strokeWidth={0}>
          <Path d="M28,66 C30,56 40,54 44,62 C46,70 38,78 30,76 Z" fill={c.patches.orange} />
          <Path d="M58,84 C60,76 70,74 72,80 C72,88 64,92 58,90 Z" fill={c.patches.black} />
        </G>
      )}
      <Ellipse cx={41} cy={92} rx={7} ry={4.5} fill={c.chest ?? c.fur} />
      <Ellipse cx={59} cy={92} rx={7} ry={4.5} fill={c.chest ?? c.fur} />
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

function CatFace({ eyes }: { eyes: string }) {
  return (
    <G>
      <Ellipse cx={42} cy={39} rx={5} ry={6} fill={eyes} />
      <Ellipse cx={58} cy={39} rx={5} ry={6} fill={eyes} />
      <Ellipse cx={42} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
      <Ellipse cx={58} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
      <Path d="M47.5,46 L52.5,46 L50,49 Z" fill="#F9A8D4" />
      <Path d="M50,49 Q47,52 45,50 M50,49 Q53,52 55,50" stroke="#9CA3AF" strokeWidth={1.2} fill="none" />
      <Path d="M30,45 L40,47 M30,50 L40,49 M70,45 L60,47 M70,50 L60,49" stroke="#9CA3AF" strokeWidth={1} />
    </G>
  );
}

// Merlin: pink collar with a star tag, and a fish he caught
function MerlinExtras() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M34,56 Q50,64 66,56" stroke="#EC4899" strokeWidth={5} fill="none" />
      <Star x={50} y={66} r={5.5} />
      {/* fish held sideways in his mouth */}
      <Path d="M36,51 C40,46 52,46 56,51 C52,56 40,56 36,51 Z" fill="#7DB7D8" strokeWidth={1.8} />
      <Path d="M56,51 L64,46 L63,56 Z" fill="#7DB7D8" strokeWidth={1.8} />
      <Path d="M44,48 Q46,51 44,54" stroke="#4B8FB3" strokeWidth={1.2} fill="none" />
      <Circle cx={40} cy={50.5} r={1.3} fill="#111" stroke="none" />
    </G>
  );
}

// Tuxie: thick nerd glasses with tape on the bridge, and a bowtie
function TuxieExtras() {
  return (
    <G stroke={OUTLINE} strokeLinejoin="round">
      <Path d="M44,58 L36,53 L36,63 Z M56,58 L64,53 L64,63 Z" fill="#DC2626" strokeWidth={1.8} />
      <Circle cx={50} cy={58} r={3} fill="#B91C1C" strokeWidth={1.5} />
      <Rect x={34.5} y={32.5} width={15} height={13} rx={3} fill="#FFFFFF" fillOpacity={0.15} stroke="#111" strokeWidth={3} />
      <Rect x={50.5} y={32.5} width={15} height={13} rx={3} fill="#FFFFFF" fillOpacity={0.15} stroke="#111" strokeWidth={3} />
      <Rect x={48} y={35.5} width={4} height={4} fill="#F5F5F4" strokeWidth={1} />
      <Path d="M34.5,36 L28,34 M65.5,36 L72,34" stroke="#111" strokeWidth={3} strokeLinecap="round" />
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

function Basset({ c }: { c: BassetColors }) {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M84,74 C98,66 100,52 95,44" stroke={OUTLINE} strokeWidth={10} fill="none" />
      <Path d="M84,74 C98,66 100,52 95,44" stroke={c.body} strokeWidth={5} fill="none" />
      <Ellipse cx={58} cy={74} rx={30} ry={20} fill={c.body} />
      <Ellipse cx={58} cy={80} rx={15} ry={13} fill={c.chest} strokeWidth={0} />
      <Ellipse cx={45} cy={93} rx={8} ry={4.5} fill={c.paws} />
      <Ellipse cx={71} cy={93} rx={8} ry={4.5} fill={c.paws} />
      <Ellipse cx={58} cy={42} rx={18} ry={20} fill={c.head} />
      {/* long droopy ears */}
      <Path d="M44,30 C28,33 22,74 32,88 C42,92 47,58 46,40 Z" fill={c.ears} />
      <Path d="M72,30 C88,33 94,74 84,88 C74,92 69,58 70,40 Z" fill={c.ears} />
      {c.blaze && <Path d="M58,24 C55,32 55,42 58,48 C61,42 61,32 58,24 Z" fill={c.blaze} strokeWidth={0} />}
      <Ellipse cx={58} cy={55} rx={12} ry={9} fill={c.muzzle} />
    </G>
  );
}

function BassetFace() {
  return (
    <G>
      <Circle cx={51} cy={43} r={3} fill="#111" />
      <Circle cx={65} cy={43} r={3} fill="#111" />
      {/* droopy lids */}
      <Path d="M47,40 Q51,38 55,41 M61,41 Q65,38 69,40" stroke="#111" strokeWidth={1.5} fill="none" />
      <Ellipse cx={58} cy={51} rx={5} ry={3.5} fill="#2B1D16" />
      <Path d="M58,54 L58,57 Q55,60 52,58 M58,57 Q61,60 64,58" stroke="#2B1D16" strokeWidth={1.5} fill="none" />
    </G>
  );
}

// Susie: a flower on top of each ear
function SusieExtras() {
  return (
    <G>
      <Flower x={40} y={30} r={5} petal="#FDA4AF" />
      <Flower x={76} y={30} r={5} petal="#FDA4AF" />
    </G>
  );
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

// Mango: a flamingo on one leg in a pink cowboy hat, chewing on wheat
function Mango() {
  const pink = '#F9A8C9';
  const deep = '#EC6FA6';
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      {/* legs: one straight, one tucked */}
      <Path d="M50,70 L50,95 M44,96 L56,96" stroke={deep} strokeWidth={3} fill="none" />
      <Path d="M60,70 L68,82 L58,85" stroke={deep} strokeWidth={3} fill="none" />
      <Path d="M76,56 L92,52 L86,62 Z" fill={deep} />
      <Ellipse cx={58} cy={60} rx={23} ry={14} fill={pink} />
      <Path d="M52,58 C60,52 72,54 76,60 C68,66 58,66 52,58 Z" fill={deep} strokeWidth={2} />
      {/* S-shaped neck */}
      <Path d="M40,58 C26,52 30,40 40,38 C48,36 46,30 40,30" stroke={OUTLINE} strokeWidth={10} fill="none" />
      <Path d="M40,58 C26,52 30,40 40,38 C48,36 46,30 40,30" stroke={pink} strokeWidth={5} fill="none" />
      <Circle cx={38} cy={26} r={10} fill={pink} />
      {/* wheat sticking out the side of the beak */}
      <Path d="M50,31 L72,22" stroke="#C99A2E" strokeWidth={1.8} fill="none" />
      <G fill="#E8B84A" strokeWidth={1.2}>
        <Ellipse cx={66} cy={22} rx={3.2} ry={1.6} rotation={-50} origin="66, 22" />
        <Ellipse cx={68} cy={26} rx={3.2} ry={1.6} rotation={30} origin="68, 26" />
        <Ellipse cx={71} cy={19} rx={3.2} ry={1.6} rotation={-50} origin="71, 19" />
        <Ellipse cx={73} cy={23} rx={3.2} ry={1.6} rotation={30} origin="73, 23" />
        <Ellipse cx={76} cy={20} rx={3.4} ry={1.6} rotation={-20} origin="76, 20" />
      </G>
      {/* beak bends down, black tip */}
      <Path d="M45,23 C52,23 56,27 55,34 C53,30 50,29 45,30 Z" fill="#FFF1E6" />
      <Path d="M55,34 C53,30 52,29.5 51,29.5 C53,27 55,29 55,34 Z" fill="#1F1D24" strokeWidth={1.5} />
      <Circle cx={37} cy={24} r={2} fill="#111" stroke="none" />
      {/* cowboy hat */}
      <Path d="M18,14 Q20,22 38,21 Q56,22 58,14 Q48,18 38,18 Q28,18 18,14 Z" fill={deep} />
      <Path d="M27,18 C26,6 30,2 38,6 C46,2 50,6 49,18 Z" fill={pink} />
      <Path d="M27,15 Q38,18 49,15" stroke={deep} strokeWidth={2.5} fill="none" />
      <Star x={38} y={10.5} r={4} />
    </G>
  );
}

// Leila: a little film camera come to life
function Leila() {
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      {/* arms and legs */}
      <Path d="M20,58 Q10,60 8,70 M80,58 Q90,56 92,46" stroke={OUTLINE} strokeWidth={3} fill="none" />
      <Circle cx={8} cy={71} r={4} fill="#F5D0A9" />
      <Circle cx={92} cy={45} r={4} fill="#F5D0A9" />
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
      <Ellipse cx={39} cy={36} rx={4.5} ry={5.5} fill="#FFFFFF" strokeWidth={1.8} />
      <Ellipse cx={61} cy={36} rx={4.5} ry={5.5} fill="#FFFFFF" strokeWidth={1.8} />
      <Circle cx={40} cy={37} r={2.4} fill="#111" stroke="none" />
      <Circle cx={62} cy={37} r={2.4} fill="#111" stroke="none" />
      <Path d="M46,42 Q50,45 54,42" strokeWidth={2} fill="none" />
      <Ellipse cx={31} cy={42} rx={3.5} ry={2} fill="#FB7185" opacity={0.6} stroke="none" />
      <Ellipse cx={69} cy={42} rx={3.5} ry={2} fill="#FB7185" opacity={0.6} stroke="none" />
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
      {/* sunglasses */}
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

const CAT_EXTRAS = { merlin: MerlinExtras, tuxie: TuxieExtras, ginger: GingerExtras };

export default function Sidekick({ kind, size = 60 }: { kind: string; size?: number }) {
  if (kind === 'merlin' || kind === 'tuxie' || kind === 'ginger') {
    const Extras = CAT_EXTRAS[kind];
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Cat c={CATS[kind]} />
        <CatFace eyes={CATS[kind].eyes} />
        <Extras />
      </Svg>
    );
  }
  if (kind === 'susie' || kind === 'scarlet') {
    return (
      <Svg width={size} height={size} viewBox="0 0 116 100">
        <Basset c={BASSETS[kind]} />
        <BassetFace />
        {kind === 'susie' ? <SusieExtras /> : <ScarletExtras />}
      </Svg>
    );
  }
  const Single = { mango: Mango, leila: Leila, gibson: Gibson }[kind];
  if (!Single) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Single />
    </Svg>
  );
}

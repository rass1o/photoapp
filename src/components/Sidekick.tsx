import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors } from '../theme';

// Legendary pets that sit beside your octopus. Same cartoon style as the
// octopus: chunky outline, simple shapes.

const OUTLINE = colors.abyss;

function Merlin() {
  const fur = '#2A2533';
  return (
    <G stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M70,88 C94,86 98,62 84,54" stroke={OUTLINE} strokeWidth={11} fill="none" />
      <Path d="M70,88 C94,86 98,62 84,54" stroke={fur} strokeWidth={6} fill="none" />
      <Ellipse cx={50} cy={72} rx={24} ry={22} fill={fur} />
      <Ellipse cx={41} cy={92} rx={7} ry={4.5} fill={fur} />
      <Ellipse cx={59} cy={92} rx={7} ry={4.5} fill={fur} />
      <Path d="M32,32 L29,8 L47,22 Z" fill={fur} />
      <Path d="M68,32 L71,8 L53,22 Z" fill={fur} />
      <Path d="M33,26 L32,15 L40,22 Z" fill="#F9A8D4" strokeWidth={0} />
      <Path d="M67,26 L68,15 L60,22 Z" fill="#F9A8D4" strokeWidth={0} />
      <Circle cx={50} cy={40} r={20} fill={fur} />
      {/* wizard's collar with a star tag */}
      <Path d="M34,56 Q50,64 66,56" stroke="#7C3AED" strokeWidth={5} fill="none" />
      <Path
        d="M50,59 L52,64 L57,64.5 L53,67.5 L54.5,72.5 L50,69.5 L45.5,72.5 L47,67.5 L43,64.5 L48,64 Z"
        fill="#FBBF24"
        strokeWidth={1.5}
      />
    </G>
  );
}

function MerlinFace() {
  return (
    <G>
      <Ellipse cx={42} cy={39} rx={5} ry={6} fill="#C6E35B" />
      <Ellipse cx={58} cy={39} rx={5} ry={6} fill="#C6E35B" />
      <Ellipse cx={42} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
      <Ellipse cx={58} cy={39.5} rx={1.6} ry={4.5} fill="#111" />
      <Path d="M47.5,46 L52.5,46 L50,49 Z" fill="#F9A8D4" />
      <Path d="M50,49 Q47,52 45,50 M50,49 Q53,52 55,50" stroke="#9CA3AF" strokeWidth={1.2} fill="none" />
      <Path d="M30,45 L40,47 M30,50 L40,49 M70,45 L60,47 M70,50 L60,49" stroke="#9CA3AF" strokeWidth={1} />
    </G>
  );
}

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

export const PET_NAMES: Record<string, string> = { merlin: 'Merlin', susie: 'Susie', scarlet: 'Scarlet' };

export default function Sidekick({ kind, size = 60 }: { kind: string; size?: number }) {
  if (kind === 'merlin') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Merlin />
        <MerlinFace />
      </Svg>
    );
  }
  if (kind === 'susie' || kind === 'scarlet') {
    return (
      <Svg width={size} height={size} viewBox="0 0 116 100">
        <Basset c={BASSETS[kind]} />
        <BassetFace />
      </Svg>
    );
  }
  return null;
}

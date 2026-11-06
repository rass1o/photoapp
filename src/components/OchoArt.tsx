import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';
import { colors } from '../theme';

// Ocho in a few set poses, drawn plain (no Skia) so they're cheap to show
// anywhere: studying a reported photo through a magnifying glass, guarding
// you from a blocked account with a shield, and just floating (the loader).
// Same drawing as the main Octopus: head at (100, 82), outline in abyss blue.

const OUTLINE = colors.abyss;
const LAVENDER = '#A78BFA';

// The tentacles that hang under him, a short and a long pair each side
const HANGING = [
  'M76,120 C68,146 62,172 76,188 C86,198 98,188 90,178',
  'M92,124 C90,150 86,172 95,186',
  'M108,124 C110,150 114,172 105,186',
  'M124,120 C132,146 138,172 124,188 C114,198 102,188 110,178',
];

function Tentacle({ d, color }: { d: string; color: string }) {
  return (
    <G strokeLinecap="round" fill="none">
      <Path d={d} stroke={OUTLINE} strokeWidth={24} />
      <Path d={d} stroke={color} strokeWidth={17} />
    </G>
  );
}

function Head({ color }: { color: string }) {
  return (
    <G>
      <Ellipse cx={100} cy={82} rx={60} ry={52} fill={color} stroke={OUTLINE} strokeWidth={4} />
      <Ellipse cx={72} cy={54} rx={15} ry={9} fill={colors.white} opacity={0.35} rotation={-30} origin="72, 54" />
    </G>
  );
}

function Cheeks({ color = '#FB7185', opacity = 0.5 }: { color?: string; opacity?: number }) {
  return (
    <G>
      <Ellipse cx={62} cy={108} rx={9} ry={5} fill={color} opacity={opacity} />
      <Ellipse cx={138} cy={108} rx={9} ry={5} fill={color} opacity={opacity} />
    </G>
  );
}

// ------------------------------------------------------------------ study

// Peering at something through a big magnifying glass held up to his right
// eye, which looks huge through the lens
export function OchoStudy({ size = 120, color = LAVENDER }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 -12 200 220">
      <Defs>
        <ClipPath id="studyLens">
          <Circle cx={126} cy={86} r={25} />
        </ClipPath>
      </Defs>
      {HANGING.map((d) => (
        <Tentacle key={d} d={d} color={color} />
      ))}
      <Tentacle d="M60,112 C38,128 26,152 38,170 C46,182 62,176 56,164" color={color} />
      <Head color={color} />
      <Cheeks />
      {/* left eye glancing over at the lens */}
      <Ellipse cx={78} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Circle cx={83} cy={90} r={7} fill={OUTLINE} />
      <Circle cx={86} cy={86} r={2.5} fill={colors.white} />
      <Path d="M64,68 Q76,60 90,66" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      {/* a curious little "o" */}
      <Ellipse cx={100} cy={116} rx={5} ry={6} fill="#7F1D1D" stroke={OUTLINE} strokeWidth={3} />
      {/* handle and the arm holding it */}
      <Tentacle d="M140,112 C156,124 168,128 170,120" color={color} />
      <Path d="M144,104 L178,144" stroke={OUTLINE} strokeWidth={12} strokeLinecap="round" />
      <Path d="M144,104 L178,144" stroke="#8B5A3C" strokeWidth={7} strokeLinecap="round" />
      {/* the tentacle tip curled round the handle */}
      <Path d="M158,118 C168,112 176,120 170,130" stroke={OUTLINE} strokeWidth={13} strokeLinecap="round" fill="none" />
      <Path d="M158,118 C168,112 176,120 170,130" stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
      {/* the lens, with his right eye magnified behind it */}
      <Circle cx={126} cy={86} r={25} fill="#E0F2FE" />
      <G clipPath="url(#studyLens)">
        <Ellipse cx={124} cy={88} rx={20} ry={23} fill={colors.white} stroke={OUTLINE} strokeWidth={4} />
        <Circle cx={124} cy={92} r={11} fill={OUTLINE} />
        <Circle cx={129} cy={86} r={4} fill={colors.white} />
        <Circle cx={126} cy={86} r={25} fill="#7DD3FC" opacity={0.18} />
      </G>
      <Circle cx={126} cy={86} r={25} fill="none" stroke={OUTLINE} strokeWidth={7} />
      <Circle cx={126} cy={86} r={25} fill="none" stroke="#94A3B8" strokeWidth={3} />
      <Path d="M110,76 Q114,68 122,66" stroke={colors.white} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.9} />
      {/* thinking sparkles */}
      <Path d="M168,52 L168,64 M162,58 L174,58" stroke="#FBBF24" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M182,78 L182,86 M178,82 L186,82" stroke="#FBBF24" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

// ----------------------------------------------------------------- shield

// Standing guard: brows down, a frown and a big shield held out in front
export function OchoShield({ size = 140, color = LAVENDER }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 -12 200 230">
      {HANGING.map((d) => (
        <Tentacle key={d} d={d} color={color} />
      ))}
      <Head color={color} />
      <Cheeks color="#EF4444" opacity={0.45} />
      {/* narrowed, upset eyes under angry brows */}
      <Ellipse cx={78} cy={90} rx={13} ry={13} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={122} cy={90} rx={13} ry={13} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Circle cx={80} cy={93} r={6.5} fill={OUTLINE} />
      <Circle cx={120} cy={93} r={6.5} fill={OUTLINE} />
      <Path d="M64,82 L92,86 L92,76 L64,74 Z M136,82 L108,86 L108,76 L136,74 Z" fill={color} />
      <Path d="M62,72 L94,84 M138,72 L106,84" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
      <Path d="M88,118 Q100,108 112,118" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none" />
      {/* a puff of steam */}
      <Path d="M162,40 C156,34 164,28 158,22 M174,48 C168,42 176,36 170,30" stroke="#CBD5E1" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      {/* the shield, gripped on both sides */}
      <G stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round">
        <Path d="M100,124 C116,132 132,132 146,128 C148,170 132,198 100,214 C68,198 52,170 54,128 C68,132 84,132 100,124 Z" fill={colors.coral} />
        <Path d="M100,136 C112,142 124,142 134,140 C134,170 122,190 100,202 C78,190 66,170 66,140 C76,142 88,142 100,136 Z" fill="#F59E8B" strokeWidth={0} />
        <Path d="M100,146 L106,160 L121,161 L109,170 L113,185 L100,176 L87,185 L91,170 L79,161 L94,160 Z" fill="#FFF7ED" strokeWidth={3.5} />
      </G>
      <Path d="M62,140 Q62,170 76,190" stroke={colors.white} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
      <Tentacle d="M58,116 C36,138 36,178 58,188 C66,192 72,184 66,178" color={color} />
      <Tentacle d="M142,116 C164,138 164,178 142,188 C134,192 128,184 134,178" color={color} />
    </Svg>
  );
}

// ------------------------------------------------------------------ plain

// Just Ocho, smiling, for the loader
export function OchoPlain({ size = 80, color = LAVENDER }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 -12 200 220">
      {HANGING.map((d) => (
        <Tentacle key={d} d={d} color={color} />
      ))}
      <Tentacle d="M60,112 C38,128 26,152 38,170 C46,182 62,176 56,164" color={color} />
      <Tentacle d="M140,112 C162,128 174,152 162,170 C154,182 138,176 144,164" color={color} />
      <Head color={color} />
      <Cheeks />
      <Ellipse cx={78} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={122} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Circle cx={80} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={124} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={83} cy={87} r={2.5} fill={colors.white} />
      <Circle cx={127} cy={87} r={2.5} fill={colors.white} />
      <Path d="M90,112 Q100,122 110,112" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

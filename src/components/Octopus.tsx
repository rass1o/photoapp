import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Text } from './Themed';
import Sidekick from './Sidekick';
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
  pet?: string | null;
  size?: number;
  animated?: boolean;
  pose?: OctopusPose;
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
    case 'cat_ears':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M52,58 Q100,8 148,58" fill="none" stroke="#2F2A3B" strokeWidth={6} />
          <Path d="M56,46 L58,2 L92,28 Z" fill="#2F2A3B" />
          <Path d="M144,46 L142,2 L108,28 Z" fill="#2F2A3B" />
          <Path d="M63,36 L64,15 L81,28 Z" fill="#F9A8D4" strokeWidth={0} />
          <Path d="M137,36 L136,15 L119,28 Z" fill="#F9A8D4" strokeWidth={0} />
        </G>
      );
    case 'sombrero':
      return (
        <G stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round">
          <Ellipse cx={100} cy={36} rx={92} ry={15} fill="#E9C46A" />
          <Path d="M70,36 C62,-28 138,-28 130,36 Z" fill="#F4D58D" />
          <Path d="M68,22 L132,22 L131,31 L69,31 Z" fill="#D62828" strokeWidth={2.5} />
          <Path d="M75,26.5 L81,26.5 M89,26.5 L95,26.5 M103,26.5 L109,26.5 M117,26.5 L123,26.5" stroke="#2A9D8F" strokeWidth={3} />
          <Path d="M14,36 Q100,58 186,36" fill="none" stroke="#C79A3A" strokeWidth={3} />
        </G>
      );
    default:
      return null;
  }
}

// Ocho rides it instead of holding it, so it's drawn under the tentacles
function Skateboard() {
  return (
    <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
      <Circle cx={56} cy={209} r={7} fill="#FDE68A" />
      <Circle cx={144} cy={209} r={7} fill="#FDE68A" />
      <Path d="M30,192 Q28,202 40,202 L160,202 Q172,202 170,192 Z" fill={colors.coral} />
      <Path d="M58,197 L142,197" stroke="#FFD2C2" strokeWidth={2.5} strokeLinecap="round" />
    </G>
  );
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
    case 'sword':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M14,4 L14,-52 L18,-62 L22,-52 L22,4 Z" fill="#DCE4EC" />
          <Path d="M18,-52 L18,0" stroke={colors.white} strokeWidth={1.5} opacity={0.8} />
          <Rect x={2} y={2} width={32} height={7} rx={3} fill="#D4A017" />
          <Rect x={14} y={9} width={8} height={18} rx={2} fill="#7C4A21" />
          <Circle cx={18} cy={30} r={4.5} fill="#D4A017" />
        </G>
      );
      break;
    case 'light_meter':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Circle cx={14} cy={-2} r={9} fill={colors.white} />
          <Rect x={0} y={2} width={28} height={36} rx={6} fill="#3F4756" />
          <Rect x={5} y={8} width={18} height={12} rx={2} fill="#E8F5E9" strokeWidth={2} />
          <Path d="M8,18 Q14,10 20,18" stroke="#9CA3AF" strokeWidth={1.2} fill="none" />
          <Path d="M14,18 L18,11" stroke="#DC2626" strokeWidth={1.5} />
          <Circle cx={14} cy={29} r={4} fill="#FBBF24" strokeWidth={2} />
        </G>
      );
      break;
    case 'shoulder_bag':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M6,10 C6,-16 36,-16 36,10" fill="none" stroke="#7C4A21" strokeWidth={4} />
          <Rect x={0} y={8} width={42} height={30} rx={6} fill="#B5651D" />
          <Path d="M0,14 L42,14 L42,24 Q21,30 0,24 Z" fill="#8B4513" />
          <Rect x={17} y={22} width={8} height={8} rx={2} fill="#D4A017" strokeWidth={2} />
        </G>
      );
      break;
    // Everyday stuff from the clam
    case 'book':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" rotation={-8} origin="18, 18">
          <Rect x={4} y={2} width={30} height={36} rx={2} fill="#FFFBEB" />
          <Rect x={0} y={0} width={30} height={36} rx={3} fill="#2563EB" />
          <Rect x={0} y={0} width={6} height={36} fill="#1E40AF" />
          <Rect x={10} y={8} width={15} height={7} rx={1} fill="#FDE68A" strokeWidth={1.5} />
        </G>
      );
      break;
    case 'donut':
      body = (
        <G stroke={OUTLINE} strokeWidth={3}>
          <Circle cx={18} cy={16} r={17} fill="#E9B872" />
          <Path d="M3,14 C4,2 32,2 33,14 C33,22 28,22 26,26 C22,30 14,30 10,26 C6,22 3,22 3,14 Z" fill="#F9A8D4" strokeWidth={0} />
          <Circle cx={18} cy={16} r={6} fill={colors.sand} />
          <Path d="M9,10 L12,8 M24,8 L27,10 M27,18 L28,21 M10,20 L8,22 M18,4 L21,5" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" />
          <Path d="M14,26 L17,27 M26,13 L28,14 M7,14 L8,17" stroke="#FACC15" strokeWidth={2} strokeLinecap="round" />
        </G>
      );
      break;
    case 'banana':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M4,6 C2,28 22,38 40,30 C30,30 14,24 10,4 Z" fill="#FDE047" />
          <Path d="M10,6 C12,20 22,28 34,30" stroke="#EAB308" strokeWidth={2} fill="none" />
          <Path d="M4,6 L5,0 L10,1 L10,4" fill="#78350F" />
        </G>
      );
      break;
    case 'rubber_duck':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M2,22 C2,10 14,12 18,16 L36,16 C42,16 42,34 30,36 L12,36 C4,36 2,30 2,22 Z" fill="#FACC15" />
          <Circle cx={12} cy={8} r={9} fill="#FACC15" />
          <Path d="M2,8 L-6,10 L2,13 Z" fill="#F97316" />
          <Circle cx={10} cy={6} r={1.8} fill={OUTLINE} strokeWidth={0} />
          <Path d="M20,24 Q28,30 34,22" fill="none" stroke="#EAB308" strokeWidth={2.5} />
        </G>
      );
      break;
    case 'pizza':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M0,0 Q20,-6 40,0 L20,40 Z" fill="#FCD34D" />
          <Path d="M0,0 Q20,-6 40,0 L38,5 Q20,-1 2,5 Z" fill="#D97706" />
          <Circle cx={14} cy={10} r={4} fill="#DC2626" strokeWidth={2} />
          <Circle cx={26} cy={13} r={4} fill="#DC2626" strokeWidth={2} />
          <Circle cx={20} cy={24} r={3.5} fill="#DC2626" strokeWidth={2} />
          <Path d="M9,18 Q9,24 13,26" fill="none" stroke="#FCD34D" strokeWidth={4} strokeLinecap="round" />
        </G>
      );
      break;
    case 'boba':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M22,-14 L18,4" stroke="#EC4899" strokeWidth={4} strokeLinecap="round" />
          <Path d="M4,6 L32,6 L28,40 L8,40 Z" fill="#E7C6A5" />
          <Path d="M4,4 Q18,-6 32,4 Z" fill="#FFFFFF" fillOpacity={0.8} />
          <Rect x={2} y={4} width={32} height={4} rx={2} fill="#FFFFFF" />
          <G fill="#3B2314" strokeWidth={0}>
            <Circle cx={12} cy={35} r={2.6} />
            <Circle cx={18} cy={33} r={2.6} />
            <Circle cx={24} cy={35} r={2.6} />
            <Circle cx={15} cy={29} r={2.6} />
            <Circle cx={21} cy={28} r={2.6} />
          </G>
        </G>
      );
      break;
    case 'ice_cream':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M4,14 L28,14 L16,44 Z" fill="#E9B872" />
          <Path d="M9,20 L21,32 M15,16 L25,24 M20,16 L10,30" stroke="#C88A3A" strokeWidth={1.5} />
          <Circle cx={16} cy={10} r={11} fill="#F9A8D4" />
          <Circle cx={16} cy={-6} r={9} fill="#A7F3D0" />
          <Circle cx={18} cy={-16} r={3.5} fill="#DC2626" />
        </G>
      );
      break;
    case 'game_controller':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M8,0 L36,0 C46,0 48,30 40,30 C34,30 32,22 28,22 L16,22 C12,22 10,30 4,30 C-4,30 -2,0 8,0 Z" fill="#7C3AED" />
          <Path d="M10,7 L10,17 M5,12 L15,12" stroke={colors.white} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={31} cy={8} r={2.6} fill="#FACC15" strokeWidth={1.5} />
          <Circle cx={36} cy={14} r={2.6} fill="#22C55E" strokeWidth={1.5} />
        </G>
      );
      break;
    case 'burger':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Rect x={2} y={28} width={36} height={8} rx={4} fill="#E9A15A" />
          <Rect x={0} y={20} width={40} height={8} rx={4} fill="#7C2D12" />
          <Path d="M0,20 L40,20 L36,24 L30,19 L24,24 L18,19 L12,24 L6,19 Z" fill="#FACC15" strokeWidth={2} />
          <Path d="M-2,16 Q4,12 8,16 Q14,12 20,16 Q26,12 32,16 Q38,12 42,16 L40,20 L0,20 Z" fill="#4ADE80" strokeWidth={2} />
          <Path d="M2,16 C2,-4 38,-4 38,16 Z" fill="#E9A15A" />
          <Path d="M12,5 L14,6 M20,3 L22,4 M27,6 L29,7" stroke="#FFF7ED" strokeWidth={2} strokeLinecap="round" />
        </G>
      );
      break;
    case 'cactus':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M8,12 Q2,12 2,2 M30,8 Q36,8 36,-2" stroke={OUTLINE} strokeWidth={11} fill="none" />
          <Path d="M8,12 Q2,12 2,2 M30,8 Q36,8 36,-2" stroke="#22A355" strokeWidth={6} fill="none" />
          <Rect x={10} y={-10} width={18} height={36} rx={9} fill="#22A355" />
          <Path d="M19,-4 L19,20" stroke="#15803D" strokeWidth={2} />
          <Circle cx={19} cy={-11} r={3.5} fill="#F472B6" strokeWidth={2} />
          <Path d="M4,24 L34,24 L30,42 L8,42 Z" fill="#E8664A" />
          <Rect x={2} y={22} width={34} height={6} rx={2} fill="#C2410C" />
        </G>
      );
      break;
    case 'popcorn':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <G fill="#FFF7D6">
            <Circle cx={8} cy={4} r={6} />
            <Circle cx={18} cy={0} r={7} />
            <Circle cx={28} cy={4} r={6} />
            <Circle cx={13} cy={-6} r={5} />
            <Circle cx={24} cy={-6} r={5} />
          </G>
          <Path d="M2,6 L34,6 L30,42 L6,42 Z" fill={colors.white} />
          <Path d="M10,6 L11,42 M18,6 L18,42 M26,6 L25,42" stroke="#DC2626" strokeWidth={4} />
          <Path d="M2,6 L34,6 L30,42 L6,42 Z" fill="none" />
        </G>
      );
      break;
    case 'umbrella':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M18,-14 L18,30 Q18,38 12,38 Q6,38 6,32" fill="none" />
          <Path d="M-8,-12 C-8,-44 44,-44 44,-12 Q38,-18 31,-12 Q24,-18 18,-12 Q12,-18 5,-12 Q-2,-18 -8,-12 Z" fill="#0EA5E9" />
          <Path d="M18,-38 C10,-34 5,-24 5,-12 M18,-38 C26,-34 31,-24 31,-12" fill="none" stroke="#0369A1" strokeWidth={2} />
          <Path d="M18,-38 L18,-43" />
        </G>
      );
      break;
    case 'guitar':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" rotation={20} origin="16, 10">
          <Rect x={13} y={-44} width={7} height={40} fill="#7C4A21" />
          <Rect x={10} y={-56} width={13} height={14} rx={3} fill="#3F2A1A" />
          <Path d="M16,-4 C2,-4 0,8 6,14 C-2,20 0,40 16,40 C32,40 34,20 26,14 C32,8 30,-4 16,-4 Z" fill="#E8664A" />
          <Circle cx={16} cy={16} r={5} fill="#3F2A1A" strokeWidth={2} />
          <Rect x={10} y={28} width={13} height={4} rx={1} fill="#3F2A1A" strokeWidth={1.5} />
          <Path d="M15,-42 L15,30 M18,-42 L18,30" stroke="#F5F5F4" strokeWidth={0.8} />
        </G>
      );
      break;
    case 'birthday_cake':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M18,-10 C14,-14 16,-18 18,-20 C20,-18 22,-14 18,-10 Z" fill="#F97316" strokeWidth={1.5} />
          <Rect x={16} y={-10} width={4} height={12} fill="#60A5FA" strokeWidth={1.5} />
          <Rect x={0} y={2} width={36} height={32} rx={4} fill="#FDF2F8" />
          <Path d="M0,8 L36,8 L36,13 Q30,18 27,12 Q22,18 18,12 Q14,18 9,12 Q4,18 0,13 Z" fill="#F472B6" strokeWidth={2} />
          <Path d="M0,24 L36,24" stroke="#F472B6" strokeWidth={3} />
          <Rect x={-4} y={34} width={44} height={5} rx={2} fill="#D9DEE5" />
        </G>
      );
      break;
    case 'boombox':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M8,0 Q8,-10 22,-10 Q36,-10 36,0" fill="none" stroke="#9CA3AF" strokeWidth={3.5} />
          <Rect x={-4} y={0} width={48} height={32} rx={5} fill="#E8664A" />
          <Rect x={12} y={4} width={20} height={8} rx={2} fill="#1E293B" strokeWidth={2} />
          <Path d="M15,8 L29,8" stroke="#4ADE80" strokeWidth={1.5} />
          <Circle cx={6} cy={20} r={8} fill="#1E293B" />
          <Circle cx={6} cy={20} r={3} fill="#9CA3AF" strokeWidth={1.5} />
          <Circle cx={34} cy={20} r={8} fill="#1E293B" />
          <Circle cx={34} cy={20} r={3} fill="#9CA3AF" strokeWidth={1.5} />
          <Path d="M48,-6 L48,-14 L54,-16 L54,-8 M48,-14 L54,-16" fill="none" stroke={OUTLINE} strokeWidth={2} />
          <Circle cx={46.5} cy={-6} r={2.2} fill={OUTLINE} strokeWidth={0} />
          <Circle cx={52.5} cy={-8} r={2.2} fill={OUTLINE} strokeWidth={0} />
        </G>
      );
      break;
    case 'disco_ball':
      body = (
        <G stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
          <Path d="M20,-16 L20,0" strokeWidth={2} />
          <Circle cx={20} cy={18} r={18} fill="#CBD5E1" />
          <G stroke="#94A3B8" strokeWidth={1.2} fill="none">
            <Path d="M3,12 L37,12 M2,18 L38,18 M3,24 L37,24 M7,30 L33,30 M7,6 L33,6" />
            <Path d="M20,0 L20,36 M13,1 Q9,18 13,35 M27,1 Q31,18 27,35" />
          </G>
          <Rect x={13.5} y={6.5} width={6} height={5} fill="#F0ABFC" strokeWidth={0} />
          <Rect x={20.5} y={12.5} width={6} height={5} fill="#7DD3FC" strokeWidth={0} />
          <Rect x={8} y={18.5} width={5} height={5} fill={colors.white} strokeWidth={0} />
          <Circle cx={20} cy={18} r={18} fill="none" />
          <Path d="M42,2 L44,-2 L46,2 L50,4 L46,6 L44,10 L42,6 L38,4 Z" fill="#FDE047" strokeWidth={1.2} />
        </G>
      );
      break;
    default:
      return null;
  }
  return <G transform="translate(146, 138)">{body}</G>;
}

function Tentacles({ paths, color }: { paths: string[]; color: string }) {
  return (
    <G>
      {paths.map((d, i) => (
        <Path key={`o${i}`} d={d} stroke={OUTLINE} strokeWidth={24} strokeLinecap="round" fill="none" />
      ))}
      {paths.map((d, i) => (
        <Path key={`f${i}`} d={d} stroke={color} strokeWidth={17} strokeLinecap="round" fill="none" />
      ))}
    </G>
  );
}

function Head({ color }: { color: string }) {
  return (
    <G>
      <Ellipse cx={100} cy={82} rx={60} ry={52} fill={color} stroke={OUTLINE} strokeWidth={4} />
      <Ellipse cx={72} cy={54} rx={15} ry={9} fill={colors.white} opacity={0.35} rotation={-30} origin="72, 54" />
      <Ellipse cx={62} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />
      <Ellipse cx={138} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />
      <Ellipse cx={78} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={122} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Path d="M90,112 Q100,122 110,112" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Pupils() {
  return (
    <G>
      <Circle cx={80} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={124} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={83} cy={87} r={2.5} fill={colors.white} />
      <Circle cx={127} cy={87} r={2.5} fill={colors.white} />
    </G>
  );
}

// Closed eyes, faded in for a blink
function Lids({ color }: { color: string }) {
  return (
    <G stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
      <Ellipse cx={78} cy={88} rx={16} ry={18} fill={color} strokeWidth={0} />
      <Ellipse cx={122} cy={88} rx={16} ry={18} fill={color} strokeWidth={0} />
      <Path d="M67,90 Q78,98 89,90 M111,90 Q122,98 133,90" fill="none" strokeWidth={3.5} />
    </G>
  );
}

// The left arm waves, so it's drawn on its own layer behind the body
const WAVE_ARM = TENTACLES[0];
const HOLD_ARM = TENTACLES[5];
const MIDDLE_ARMS = TENTACLES.slice(1, 5);

// viewBox units -> points, for pivots and offsets
const VB_W = 200;
const VB_TOP = -30;

const BUBBLES = [
  { r: 7, dx: 55, delay: 0 },
  { r: 5, dx: 80, delay: 260 },
  { r: 9, dx: 40, delay: 520 },
];

// While peeking, this tentacle reaches up in front to hold the camera
const PEEK_ARM = 'M132,132 C170,128 170,96 146,92';

// 'peek': lifts a camera to his eye and back down, waving in between
export type OctopusPose = 'idle' | 'peek';

export default function Octopus({ color, accessory, heldItem, pet, size = 140, animated = true, pose = 'idle' }: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current; // degrees
  const lookX = useRef(new Animated.Value(0)).current;
  const lookY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const peek = useRef(new Animated.Value(0)).current;
  const bubbles = useRef(BUBBLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!animated) return;
    const ease = Easing.inOut(Easing.sin);
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1400, easing: ease, useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1400, easing: ease, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: 2100, easing: ease, useNativeDriver: true }),
          Animated.timing(sway, { toValue: -1, duration: 2100, easing: ease, useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());

    const t = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: ease, useNativeDriver: true });

    const doWave = (swings = 3) =>
      Animated.sequence([
        t(wave, 120, 320),
        ...Array.from({ length: swings }, () => [t(wave, 140, 200), t(wave, 105, 200)]).flat(),
        t(wave, 0, 380),
      ]);
    const doBlink = () =>
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.delay(90),
        Animated.timing(blink, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]);
    const doLook = () => {
      const x = Math.random() < 0.5 ? -1 : 1;
      const y = Math.random() * 1.2 - 0.6;
      return Animated.sequence([
        Animated.parallel([t(lookX, x, 260), t(lookY, y, 260)]),
        Animated.delay(700),
        Animated.parallel([t(lookX, -x, 380), t(lookY, -y * 0.5, 380)]),
        Animated.delay(600),
        Animated.parallel([t(lookX, 0, 260), t(lookY, 0, 260)]),
      ]);
    };
    const doBubbles = () =>
      Animated.parallel(
        bubbles.map((b, i) =>
          Animated.sequence([
            Animated.delay(BUBBLES[i].delay),
            Animated.timing(b, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        )
      );
    const doPeek = () =>
      Animated.sequence([
        t(peek, 1, 500),
        Animated.delay(1300),
        doBlink(),
        Animated.delay(300),
        t(peek, 0, 500),
        Animated.delay(250),
        doWave(3),
        Animated.delay(500),
      ]);

    // Every few seconds he does something: waves, looks around, blinks or
    // blows bubbles. Posed octopuses run their pose on repeat instead.
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const roll = Math.random();
        const action =
          pose === 'peek'
            ? doPeek()
            : roll < 0.25
              ? doWave()
              : roll < 0.5
                ? doLook()
                : roll < 0.75
                  ? doBubbles()
                  : doBlink();
        action.start(() => alive && next());
      }, pose === 'peek' ? 300 : 1600 + Math.random() * 2400);
    };
    next();
    // Blinks also happen on their own now and then
    let blinkTimer: ReturnType<typeof setTimeout>;
    const blinkLater = () => {
      blinkTimer = setTimeout(() => {
        if (!alive) return;
        doBlink().start(blinkLater);
      }, 2500 + Math.random() * 3500);
    };
    blinkLater();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(blinkTimer);
      loops.forEach((l) => l.stop());
      [bob, sway, wave, lookX, lookY, blink, peek, ...bubbles].forEach((v) => v.stopAnimation());
    };
  }, [animated, pose, bob, sway, wave, lookX, lookY, blink, peek, bubbles]);

  const width = size;
  const height = size * 1.25;
  const k = size / VB_W;
  const viewBox = `0 ${VB_TOP} 200 250`;
  const holding = pose === 'peek' ? 'camera' : heldItem;

  const still = (
    <Svg width={width} height={height} viewBox={viewBox}>
      {holding === 'skateboard' ? <Skateboard /> : null}
      <Tentacles paths={TENTACLES} color={color} />
      <Head color={color} />
      <Pupils />
      {accessory ? <Accessory kind={accessory} /> : null}
      {holding && holding !== 'skateboard' ? <HeldItem kind={holding} /> : null}
    </Svg>
  );

  // Rotate a layer around a point given in viewBox units
  const around = (x: number, y: number, rotate: Animated.AnimatedInterpolation<string>) => {
    const dx = x * k - width / 2;
    const dy = (y - VB_TOP) * k - height / 2;
    return [{ translateX: dx }, { translateY: dy }, { rotate }, { translateX: -dx }, { translateY: -dy }];
  };
  const deg = (v: Animated.Value, range: [number, number]) =>
    v.interpolate({ inputRange: range, outputRange: range.map((n) => `${n}deg`) });

  const layer = (children: ReactNode, style?: object) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height} viewBox={viewBox}>
        {children}
      </Svg>
    </Animated.View>
  );

  const octopus = !animated ? still : (
    <Animated.View
      style={{
        width,
        height,
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.04] }) },
          ...around(100, 200, sway.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] })),
        ],
      }}
    >
      {layer(<Tentacles paths={[WAVE_ARM]} color={color} />, { transform: around(66, 100, deg(wave, [0, 360])) })}
      {pose === 'peek' &&
        layer(<Tentacles paths={[HOLD_ARM]} color={color} />, {
          transform: around(140, 108, peek.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '100deg'] })),
        })}
      {layer(
        <G>
          {holding === 'skateboard' ? <Skateboard /> : null}
          <Tentacles paths={pose === 'peek' ? MIDDLE_ARMS : [...MIDDLE_ARMS, HOLD_ARM]} color={color} />
          <Head color={color} />
        </G>
      )}
      {layer(<Pupils />, {
        transform: [
          { translateX: lookX.interpolate({ inputRange: [-1, 1], outputRange: [-5 * k, 5 * k] }) },
          { translateY: lookY.interpolate({ inputRange: [-1, 1], outputRange: [-4 * k, 4 * k] }) },
        ],
      })}
      {layer(<Lids color={color} />, { opacity: blink })}
      {layer(
        <G>
          {accessory ? <Accessory kind={accessory} /> : null}
          {pose !== 'peek' && holding && holding !== 'skateboard' ? <HeldItem kind={holding} /> : null}
        </G>
      )}
      {pose === 'peek' &&
        layer(<Tentacles paths={[PEEK_ARM]} color={color} />, {
          opacity: peek.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
        })}
      {pose === 'peek' &&
        layer(<HeldItem kind="camera" />, {
          transform: [
            { translateX: peek.interpolate({ inputRange: [0, 1], outputRange: [0, -45 * k] }) },
            { translateY: peek.interpolate({ inputRange: [0, 1], outputRange: [0, -62 * k] }) },
          ],
        })}
      {bubbles.map((b, i) => {
        const r = BUBBLES[i].r * k;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.airBubble,
              {
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                borderWidth: Math.max(1, 2 * k),
                left: 110 * k - r,
                top: (116 - VB_TOP) * k - r,
                opacity: b.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                transform: [
                  { translateX: b.interpolate({ inputRange: [0, 1], outputRange: [0, BUBBLES[i].dx * k] }) },
                  { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [0, -110 * k] }) },
                  { scale: b.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );

  if (!pet) return octopus;

  // The sidekick sits on the left, away from the held item on the right
  return (
    <View style={{ paddingLeft: size * PET_SPACE, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={[styles.pet, { bottom: size * 0.1, width: size * PET_SIZE }]}>
        <Sidekick kind={pet} size={size * PET_SIZE} animated={animated} />
      </View>
      {octopus}
    </View>
  );
}

const PET_SIZE = 0.5;
const PET_SPACE = 0.36; // how far the pet sticks out past the octopus

// Octopus with its name and a speech bubble, used on profiles
export function OctopusCard({
  name,
  line,
  color,
  accessory,
  heldItem,
  pet,
  size = 120,
}: {
  name: string;
  line: string;
  color: string;
  accessory?: string | null;
  heldItem?: string | null;
  pet?: string | null;
  size?: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{line.replace('{name}', name)}</Text>
        <View style={styles.bubbleTail} />
      </View>
      <Octopus color={color} accessory={accessory} heldItem={heldItem} pet={pet} size={size} />
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pet: { position: 'absolute', left: 0 },
  airBubble: { position: 'absolute', borderColor: '#7CC6E8', backgroundColor: 'rgba(255,255,255,0.55)' },
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

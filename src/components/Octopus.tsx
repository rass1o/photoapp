import { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { Pressable, View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle as SkCircle,
  Group as SkGroup,
  Oval as SkOval,
  Path as SkPath,
  Skia,
  vec,
} from '@shopify/react-native-skia';
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
  tappable?: boolean; // tap to squish him and get a reaction
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

// ---------------------------------------------------------------- still

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

// Body, shine and cheeks: the parts of the head that never move
function HeadBase({ color }: { color: string }) {
  return (
    <G>
      <Ellipse cx={100} cy={82} rx={60} ry={52} fill={color} stroke={OUTLINE} strokeWidth={4} />
      <Ellipse cx={72} cy={54} rx={15} ry={9} fill={colors.white} opacity={0.35} rotation={-30} origin="72, 54" />
      <Ellipse cx={62} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />
      <Ellipse cx={138} cy={108} rx={9} ry={5} fill="#fb7185" opacity={0.5} />
    </G>
  );
}

function StillFace() {
  return (
    <G>
      <Ellipse cx={78} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Ellipse cx={122} cy={88} rx={13} ry={15} fill={colors.white} stroke={OUTLINE} strokeWidth={3} />
      <Circle cx={80} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={124} cy={91} r={7} fill={OUTLINE} />
      <Circle cx={83} cy={87} r={2.5} fill={colors.white} />
      <Circle cx={127} cy={87} r={2.5} fill={colors.white} />
      <Path d="M90,112 Q100,122 110,112" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </G>
  );
}

// ------------------------------------------------------------- animated
//
// The moving parts (tentacles, body, face, bubbles) are drawn with Skia, which
// paints straight on the GPU and takes Reanimated values directly, so a frame
// never goes back through React or react-native-svg. His gear stays in SVG,
// on still layers above and below.

// Every tentacle and the mouth are "M p C p p p C p p p": 14 numbers that
// can be blended point by point, so shapes can bend into each other
const points = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
function pathFrom(p: number[]) {
  'worklet';
  return Skia.PathBuilder.Make()
    .moveTo(p[0], p[1])
    .cubicTo(p[2], p[3], p[4], p[5], p[6], p[7])
    .cubicTo(p[8], p[9], p[10], p[11], p[12], p[13])
    .build();
}

const REST = TENTACLES.map(points);
// Left arm raised to wave, swinging between these two
const WAVE_IN = points('M60,112 C40,104 24,84 26,62 C27,48 42,46 40,58');
const WAVE_OUT = points('M60,112 C38,108 21,94 17,72 C14,58 27,52 31,62');
// Right arm curled up in front of the face, holding the camera to his eye
const PEEK_UP = points('M132,132 C168,128 172,100 150,92 C142,89 138,92 140,98');
// How much each point drifts in the idle ripple: none at the root, most at the tip
const RIPPLE = [0, 0.25, 0.5, 0.7, 0.85, 1, 1];

const SMILE = points('M90,112 C93,119 107,119 110,112 C107,119 93,119 90,112');
const OH = points('M95,114 C95,107 105,107 105,114 C105,121 95,121 95,114');
const LAUGH = points('M88,111 C94,111 106,111 112,111 C110,125 90,125 88,111');
const FROWN = points('M90,117 C93,110 107,110 110,117 C107,110 93,110 90,117');

type Raise = { up: number[]; alt?: number[]; amount: SharedValue<number>; swing?: SharedValue<number> };

// One tentacle: drifts gently on its own, and can bend into a raised pose
function Tentacle({
  rest,
  phase,
  ripple,
  t,
  amp,
  raise,
  color,
  opacity,
}: {
  rest: number[];
  phase: number;
  ripple: number;
  t: SharedValue<number>;
  amp: SharedValue<number>; // 0 = still, 1 = full ripple
  raise?: Raise;
  color: string;
  opacity?: SharedValue<number>;
}) {
  const path = useDerivedValue(() => {
    const k = raise ? raise.amount.value : 0;
    const s = raise?.swing ? raise.swing.value : 0;
    const drift = Math.sin(t.value + phase) * ripple * amp.value * (1 - k);
    const out: number[] = [];
    for (let i = 0; i < 14; i++) {
      let up = rest[i];
      if (raise) up = raise.up[i] + (raise.alt ? (raise.alt[i] - raise.up[i]) * s : 0);
      let v = rest[i] + (up - rest[i]) * k;
      if (i % 2 === 0) v += drift * RIPPLE[i / 2];
      else v += drift * RIPPLE[(i - 1) / 2] * 0.3;
      out.push(v);
    }
    return pathFrom(out);
  });
  return (
    <SkGroup opacity={opacity ?? 1}>
      <SkPath path={path} style="stroke" strokeWidth={24} strokeCap="round" color={OUTLINE} />
      <SkPath path={path} style="stroke" strokeWidth={17} strokeCap="round" color={color} />
    </SkGroup>
  );
}

// Body, shine and cheeks
function SkHead({ color }: { color: string }) {
  return (
    <SkGroup>
      <SkOval x={40} y={30} width={120} height={104} color={color} />
      <SkOval x={40} y={30} width={120} height={104} color={OUTLINE} style="stroke" strokeWidth={4} />
      <SkGroup transform={[{ rotate: -Math.PI / 6 }]} origin={vec(72, 54)}>
        <SkOval x={57} y={45} width={30} height={18} color={colors.white} opacity={0.35} />
      </SkGroup>
      <SkOval x={53} y={103} width={18} height={10} color="#fb7185" opacity={0.5} />
      <SkOval x={129} y={103} width={18} height={10} color="#fb7185" opacity={0.5} />
    </SkGroup>
  );
}

// Eye that blinks (squashes flat) and whose pupil looks around
function Eye({
  cx,
  look,
  blink,
}: {
  cx: number;
  look: { x: SharedValue<number>; y: SharedValue<number> };
  blink: SharedValue<number>;
}) {
  const y = useDerivedValue(() => 88 - (15 - 13 * blink.value));
  const height = useDerivedValue(() => 2 * (15 - 13 * blink.value));
  const pupilsShown = useDerivedValue(() => (blink.value > 0.6 ? 0 : 1));
  const pupilX = useDerivedValue(() => cx + 2 + look.x.value * 5);
  const pupilY = useDerivedValue(() => 91 + look.y.value * 4);
  const pupilR = useDerivedValue(() => 7 * (1 - blink.value * 0.6));
  const shineX = useDerivedValue(() => cx + 5 + look.x.value * 5);
  const shineY = useDerivedValue(() => 87 + look.y.value * 4);
  return (
    <SkGroup>
      <SkOval x={cx - 13} y={y} width={26} height={height} color={colors.white} />
      <SkOval x={cx - 13} y={y} width={26} height={height} color={OUTLINE} style="stroke" strokeWidth={3} />
      <SkGroup opacity={pupilsShown}>
        <SkCircle cx={pupilX} cy={pupilY} r={pupilR} color={OUTLINE} />
        <SkCircle cx={shineX} cy={shineY} r={2.5} color={colors.white} />
      </SkGroup>
    </SkGroup>
  );
}

// Smile, turned down into a frown by anger, opened into an "O" by open,
// or into a big laughing "D" by laugh
function Mouth({ open, anger, laugh }: { open: SharedValue<number>; anger: SharedValue<number>; laugh: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const k = open.value;
    const a = anger.value;
    const l = laugh.value;
    return pathFrom(SMILE.map((v, i) => {
      const base = v + (FROWN[i] - v) * a;
      const rounded = base + (OH[i] - base) * k;
      return rounded + (LAUGH[i] - rounded) * l;
    }));
  });
  return (
    <SkGroup>
      <SkPath path={path} color={OUTLINE} />
      <SkPath path={path} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" color={OUTLINE} />
    </SkGroup>
  );
}

// Happy squeezed-shut eyes for giggling: ^ ^
function HappyEyes({ happy }: { happy: SharedValue<number> }) {
  return (
    <SkGroup opacity={happy}>
      <SkPath path="M67,92 Q78,80 89,92" style="stroke" strokeWidth={4} strokeCap="round" color={OUTLINE} />
      <SkPath path="M111,92 Q122,80 133,92" style="stroke" strokeWidth={4} strokeCap="round" color={OUTLINE} />
    </SkGroup>
  );
}

// Angry brows, flushed cheeks and steam puffing off his head
function AngryFace({ anger, steam }: { anger: SharedValue<number>; steam: SharedValue<number> }) {
  const puffY = useDerivedValue(() => 30 - 22 * steam.value);
  const puffR = useDerivedValue(() => 5 + 6 * steam.value);
  const puffOpacity = useDerivedValue(() => anger.value * interpolate(steam.value, [0, 0.2, 1], [0, 0.9, 0]));
  const blush = useDerivedValue(() => anger.value * 0.6);
  return (
    <SkGroup>
      <SkGroup opacity={blush}>
        <SkOval x={49} y={101} width={26} height={14} color="#ef4444" />
        <SkOval x={125} y={101} width={26} height={14} color="#ef4444" />
      </SkGroup>
      <SkGroup opacity={anger}>
        <SkPath path="M62,66 L91,77" style="stroke" strokeWidth={6} strokeCap="round" color={OUTLINE} />
        <SkPath path="M138,66 L109,77" style="stroke" strokeWidth={6} strokeCap="round" color={OUTLINE} />
      </SkGroup>
      <SkGroup opacity={puffOpacity}>
        <SkCircle cx={58} cy={puffY} r={puffR} color="#E5E7EB" />
        <SkCircle cx={142} cy={puffY} r={puffR} color="#E5E7EB" />
        <SkCircle cx={58} cy={puffY} r={puffR} color="#9CA3AF" style="stroke" strokeWidth={2} />
        <SkCircle cx={142} cy={puffY} r={puffR} color="#9CA3AF" style="stroke" strokeWidth={2} />
      </SkGroup>
    </SkGroup>
  );
}

const BUBBLES = [
  { r: 7, dx: 55 },
  { r: 5, dx: 80 },
  { r: 9, dx: 40 },
];

function Bubble({ p, r, dx }: { p: SharedValue<number>; r: number; dx: number }) {
  const cx = useDerivedValue(() => 110 + dx * p.value);
  const cy = useDerivedValue(() => 112 - 120 * p.value);
  const radius = useDerivedValue(() => r * (0.3 + 0.7 * p.value));
  const opacity = useDerivedValue(() =>
    p.value <= 0 ? 0 : interpolate(p.value, [0, 0.1, 0.7, 1], [0, 1, 0.9, 0])
  );
  return (
    <SkGroup opacity={opacity}>
      <SkCircle cx={cx} cy={cy} r={radius} color="rgba(255,255,255,0.55)" />
      <SkCircle cx={cx} cy={cy} r={radius} color="#7CC6E8" style="stroke" strokeWidth={2.5} />
    </SkGroup>
  );
}

// Tab screens stay mounted in the background; pause there so a hidden Ocho
// doesn't eat frames from the screen you're on. Outside navigation
// (onboarding) there's no screen to track, so he's always on.
function useScreenFocused() {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

// 'peek': lifts a camera to his eye and back down, waving in between
export type OctopusPose = 'idle' | 'peek';

function LivelyOctopus({
  color,
  accessory,
  heldItem,
  size,
  pose,
  tappable,
}: {
  color: string;
  accessory?: string | null;
  heldItem?: string | null;
  size: number;
  pose: OctopusPose;
  tappable: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const focused = useScreenFocused();
  const active = focused && !reduceMotion;
  const t = useSharedValue(0);
  const amp = useSharedValue(0);
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const giggle = useSharedValue(0);
  const hop = useSharedValue(0);
  const happy = useSharedValue(0);
  const laugh = useSharedValue(0);
  const anger = useSharedValue(0);
  const steam = useSharedValue(0);
  const squishX = useSharedValue(1);
  const squishY = useSharedValue(1);
  const raise = useSharedValue(0);
  const swing = useSharedValue(0);
  const peek = useSharedValue(0);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const blink = useSharedValue(0);
  const mouth = useSharedValue(0);
  const b0 = useSharedValue(0);
  const b1 = useSharedValue(0);
  const b2 = useSharedValue(0);
  const bubbles = [b0, b1, b2];
  const leftBlink = useDerivedValue(() => Math.max(blink.value, peek.value * 0.85));

  const ease = Easing.inOut(Easing.sin);
  const to = (toValue: number, duration: number, easing = ease) => withTiming(toValue, { duration, easing });

  // Each returns how long it runs, so the next one can wait its turn
  const actions = {
    wave: (swings = 3) => {
      raise.value = withSequence(to(1, 380), withDelay(swings * 420, to(0, 420)));
      swing.value = withDelay(
        200,
        withSequence(withRepeat(withSequence(to(1, 210), to(0, 210)), swings), to(0, 10))
      );
      return 380 + swings * 420 + 420;
    },
    look: () => {
      const x = Math.random() < 0.5 ? -1 : 1;
      const y = Math.random() * 1.2 - 0.6;
      lookX.value = withSequence(to(x, 260), withDelay(700, to(-x, 380)), withDelay(600, to(0, 260)));
      lookY.value = withSequence(to(y, 260), withDelay(700, to(-y * 0.5, 380)), withDelay(600, to(0, 260)));
      return 2300;
    },
    blink: () => {
      blink.value = withSequence(to(1, 70), withDelay(70, to(0, 100)));
      return 260;
    },
    bubbles: () => {
      mouth.value = withSequence(to(1, 220), withDelay(1500, to(0, 260)));
      bubbles.forEach((b, i) => {
        b.value = withDelay(
          260 + i * 280,
          withSequence(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }))
        );
      });
      return 2400;
    },
    // Eyes squeezed shut, a couple of hops and a "ha-ha" mouth
    giggle: () => {
      giggle.value = withSequence(to(-1, 70), to(1, 90), to(-1, 90), to(1, 90), to(-0.6, 90), to(0, 80));
      hop.value = withSequence(to(1, 110), to(0, 130), to(0.6, 100), to(0, 130));
      blink.value = withSequence(to(1, 70), withDelay(440, to(0, 110)));
      happy.value = withSequence(to(1, 70), withDelay(440, to(0, 110)));
      laugh.value = withSequence(to(1, 90), to(0.45, 90), to(1, 90), to(0.45, 90), to(0, 140));
      return 640;
    },
    // Fed up: brows down, red cheeks, a frown, steam and a shake. Then he
    // closes his eyes, lets out a sigh (and a bubble) and he's fine again.
    angry: () => {
      anger.value = withSequence(to(1, 180), withDelay(1820, to(0, 700)));
      steam.value = withRepeat(withSequence(withTiming(1, { duration: 650, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), 3);
      giggle.value = withSequence(withRepeat(withSequence(to(-0.45, 55), to(0.45, 55)), 16), to(0, 80));
      blink.value = withSequence(to(0.35, 180), withDelay(1820, to(1, 300)), withDelay(500, to(0, 300)));
      mouth.value = withDelay(2350, withSequence(to(0.45, 300), withDelay(250, to(0, 400))));
      b2.value = withDelay(2450, withSequence(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })));
      return 3900;
    },
    // Redrawing tentacle shapes is the costly part, so they only ripple
    // now and then instead of on every frame
    ripple: () => {
      t.value = withTiming(t.value + Math.PI * 3, { duration: 2800, easing: Easing.linear });
      amp.value = withSequence(to(1, 500), withDelay(1600, to(0, 700)));
      return 2800;
    },
    peek: () => {
      peek.value = withSequence(to(1, 550), withDelay(1400, to(0, 550)));
      blink.value = withDelay(1100, withSequence(to(1, 70), withDelay(70, to(0, 100))));
      return 2600;
    },
  };

  useEffect(() => {
    if (!active) return;
    bob.value = withRepeat(to(1, 1400), -1, true);
    sway.value = withSequence(to(-1, 1050), withRepeat(withSequence(to(1, 2100), to(-1, 2100)), -1));

    // Every few seconds he does something; a posed octopus runs its pose
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = (wait: number) => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (Date.now() < busyUntil.current) return next(500);
        let took: number;
        if (pose === 'peek') {
          took = actions.peek();
          setTimeout(() => alive && actions.wave(3), took + 200);
          took += 200 + 380 + 3 * 420 + 420 + 500;
        } else {
          const roll = Math.random();
          took =
            roll < 0.2
              ? actions.wave()
              : roll < 0.4
                ? actions.look()
                : roll < 0.6
                  ? actions.bubbles()
                  : roll < 0.8
                    ? actions.ripple()
                    : actions.blink();
        }
        next(took + (pose === 'peek' ? 300 : 1400 + Math.random() * 2400));
      }, wait);
    };
    next(pose === 'peek' ? 300 : 1200 + Math.random() * 1500);

    let blinkTimer: ReturnType<typeof setTimeout>;
    const blinkLater = () => {
      blinkTimer = setTimeout(() => {
        if (!alive) return;
        if (Date.now() >= busyUntil.current) actions.blink();
        blinkLater();
      }, 2600 + Math.random() * 3600);
    };
    blinkLater();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(blinkTimer);
      // Settle back to rest so he's tidy when the screen comes back
      [t, amp, bob, sway, giggle, hop, happy, laugh, anger, steam, raise, swing, peek, lookX, lookY, blink, mouth, ...bubbles].forEach((v) => {
        cancelAnimation(v);
        v.value = 0;
      });
    };
    // actions only touch shared values, which never change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, active]);

  // Tapping squishes him like a water balloon and he giggles. Poke him
  // five times in a row and he gets angry, then calms back down.
  const taps = useRef({ count: 0, last: 0 });
  const busyUntil = useRef(0);
  const onTap = () => {
    squishX.value = withSequence(withTiming(1.14, { duration: 90 }), withSpring(1, { damping: 5, stiffness: 220 }));
    squishY.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { damping: 5, stiffness: 220 }));
    if (pose === 'peek' || reduceMotion) return;
    const now = Date.now();
    if (now < busyUntil.current && anger.value > 0) return; // still fuming
    if (now - taps.current.last > 4000) taps.current.count = 0;
    taps.current.last = now;
    taps.current.count += 1;
    if (taps.current.count >= 5) {
      taps.current.count = 0;
      busyUntil.current = now + actions.angry();
    } else {
      busyUntil.current = now + actions.giggle();
    }
  };

  const width = size;
  const height = size * 1.25;
  const k = size / 200;

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: -size * 0.04 * bob.value - size * 0.07 * hop.value },
      { rotate: `${sway.value * 4 + giggle.value * 7}deg` },
      { scaleX: squishX.value },
      { scaleY: squishY.value },
    ],
  }));
  const camera = useAnimatedStyle(() => ({
    transform: [{ translateX: -45 * k * peek.value }, { translateY: -62 * k * peek.value }],
  }));
  const peekFront = useDerivedValue(() => (peek.value < 0.5 ? 0 : (peek.value - 0.5) * 2));

  const look = { x: lookX, y: lookY };
  const holding = pose === 'peek' ? null : heldItem;

  // Skateboard under him and his gear on top stay as still SVG layers;
  // everything that moves is on the Skia canvas in between
  const viewBox = '0 -30 200 250';
  const still = (children: ReactNode) => (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} viewBox={viewBox}>
        {children}
      </Svg>
    </View>
  );

  const drawing = (
    <Reanimated.View style={[{ width, height, transformOrigin: 'bottom' }, body]}>
      {holding === 'skateboard' && still(<Skateboard />)}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Canvas style={{ width, height }}>
          {/* viewBox units: scale to points, then shift down past the hat room */}
          <SkGroup transform={[{ scale: k }]}>
            <SkGroup transform={[{ translateY: 30 }]}>
              <Tentacle rest={REST[0]} phase={0} ripple={3} t={t} amp={amp} color={color} raise={{ up: WAVE_IN, alt: WAVE_OUT, amount: raise, swing }} />
              {[1, 2, 3, 4].map((i) => (
                <Tentacle key={i} rest={REST[i]} phase={i * 1.3} ripple={3.5} t={t} amp={amp} color={color} />
              ))}
              <Tentacle
                rest={REST[5]}
                phase={0}
                ripple={0}
                t={t}
                amp={amp}
                color={color}
                raise={pose === 'peek' ? { up: PEEK_UP, amount: peek } : undefined}
              />
              <SkHead color={color} />
              <Eye cx={78} look={look} blink={leftBlink} />
              <Eye cx={122} look={look} blink={blink} />
              <HappyEyes happy={happy} />
              <AngryFace anger={anger} steam={steam} />
              <Mouth open={mouth} anger={anger} laugh={laugh} />
              {BUBBLES.map((b, i) => (
                <Bubble key={i} p={bubbles[i]} r={b.r} dx={b.dx} />
              ))}
              {/* while peeking, the raised arm comes round in front of his face */}
              {pose === 'peek' && (
                <Tentacle rest={REST[5]} phase={0} ripple={0} t={t} amp={amp} color={color} raise={{ up: PEEK_UP, amount: peek }} opacity={peekFront} />
              )}
            </SkGroup>
          </SkGroup>
        </Canvas>
      </View>
      {(accessory || (holding && holding !== 'skateboard')) &&
        still(
          <G>
            {accessory ? <Accessory kind={accessory} /> : null}
            {holding && holding !== 'skateboard' ? <HeldItem kind={holding} /> : null}
          </G>
        )}
      {pose === 'peek' && (
        <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, camera]}>
          <Svg width={width} height={height} viewBox={viewBox}>
            <HeldItem kind="camera" />
          </Svg>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );

  if (!tappable) return drawing;
  return (
    <Pressable onPress={onTap} hitSlop={6}>
      {drawing}
    </Pressable>
  );
}

export default function Octopus({
  color,
  accessory,
  heldItem,
  pet,
  size = 140,
  animated = true,
  pose = 'idle',
  tappable = false,
}: Props) {
  const focused = useScreenFocused();
  const octopus = animated ? (
    <LivelyOctopus color={color} accessory={accessory} heldItem={heldItem} size={size} pose={pose} tappable={tappable} />
  ) : (
    <Svg width={size} height={size * 1.25} viewBox="0 -30 200 250">
      {heldItem === 'skateboard' ? <Skateboard /> : null}
      <Tentacles paths={TENTACLES} color={color} />
      <HeadBase color={color} />
      <StillFace />
      {accessory ? <Accessory kind={accessory} /> : null}
      {heldItem && heldItem !== 'skateboard' ? <HeldItem kind={heldItem} /> : null}
    </Svg>
  );

  if (!pet) return octopus;

  // The sidekick sits on the left, away from the held item on the right
  return (
    <View style={{ paddingLeft: size * PET_SPACE, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={[styles.pet, { bottom: size * 0.1, width: size * PET_SIZE }]}>
        <Sidekick kind={pet} size={size * PET_SIZE} animated={animated && focused} />
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
      <Octopus color={color} accessory={accessory} heldItem={heldItem} pet={pet} size={size} tappable />
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pet: { position: 'absolute', left: 0 },
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

import { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Designed profile banners. A banner's value is either a plain color (the
// original banners) or one of these scene names. Scenes stay light and keep
// their artwork toward the edges, so the profile's name and bio stay readable.

type Scene = { color: string; top: string; art: () => ReactElement };

const W = 400;
const H = 260;

const SCENES: Record<string, Scene> = {
  shark: {
    color: '#A9DCEB',
    top: '#D7F1F8',
    art: () => (
      <G>
        {/* sun rays from the surface */}
        <Path d="M60,0 L110,0 L40,260 L10,260 Z M250,0 L290,0 L330,260 L280,260 Z" fill="#FFFFFF" opacity={0.18} />
        {/* the shark, soft so text sits fine over it */}
        <G opacity={0.32} fill="#2C5872">
          <Path d="M240,150 C270,128 330,124 372,140 L392,122 L388,150 L398,170 L372,158 C330,176 270,170 240,150 Z" />
          <Path d="M300,132 L312,104 L322,134 Z" />
          <Path d="M300,162 L310,180 L318,164 Z" />
        </G>
        <G fill="#FFFFFF" opacity={0.6}>
          <Circle cx={60} cy={190} r={6} />
          <Circle cx={74} cy={170} r={4} />
          <Circle cx={66} cy={150} r={3} />
        </G>
      </G>
    ),
  },
  island: {
    color: '#9ED9E8',
    top: '#E3F6FB',
    art: () => (
      <G>
        <Circle cx={330} cy={60} r={26} fill="#FDE68A" opacity={0.9} />
        <Path d="M0,190 Q100,180 200,190 T400,190 L400,260 L0,260 Z" fill="#7CCFE0" />
        {/* the island, off to one side */}
        <Path d="M20,192 C40,170 110,168 136,192 Z" fill="#F2D59A" />
        <Path d="M78,184 C76,150 82,128 92,112" stroke="#8B5A3C" strokeWidth={5} fill="none" strokeLinecap="round" />
        <G fill="#3FA796">
          <Path d="M92,112 C76,100 60,104 52,114 C66,108 80,110 92,112 Z" />
          <Path d="M92,112 C100,96 116,94 126,100 C112,100 102,104 92,112 Z" />
          <Path d="M92,112 C84,94 88,82 96,76 C94,90 94,100 92,112 Z" />
          <Path d="M92,112 C108,108 120,116 124,126 C112,118 102,114 92,112 Z" />
        </G>
        <Path d="M250,150 Q262,144 274,150 M280,140 Q290,135 300,140" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.7} />
      </G>
    ),
  },
  coral_reef: {
    color: '#BFE8E4',
    top: '#E6F7F5',
    art: () => (
      <G>
        <Path d="M0,214 Q60,200 120,214 T240,214 T360,214 L400,214 L400,260 L0,260 Z" fill="#F2D59A" />
        {/* corals at both corners */}
        <G strokeLinecap="round" fill="none" opacity={0.85}>
          <Path d="M30,216 L30,176 M30,196 L16,182 M30,190 L44,170" stroke="#FB7185" strokeWidth={7} />
          <Path d="M64,216 C60,196 70,186 66,166" stroke="#F97316" strokeWidth={6} />
          <Path d="M340,216 L340,170 M340,192 L326,178 M340,186 L356,164" stroke="#C084FC" strokeWidth={7} />
          <Path d="M372,216 C376,194 366,184 372,162" stroke="#FB7185" strokeWidth={6} />
        </G>
        <Ellipse cx={100} cy={214} rx={18} ry={9} fill="#F472B6" opacity={0.7} />
        <G opacity={0.5}>
          <Path d="M290,96 C298,88 314,88 320,96 C314,104 298,104 290,96 Z M320,96 L328,90 L328,102 Z" fill="#F59E0B" />
          <Path d="M70,70 C76,64 88,64 92,70 C88,76 76,76 70,70 Z M92,70 L98,66 L98,74 Z" fill="#38BDF8" />
        </G>
      </G>
    ),
  },
  whale: {
    color: '#B8DDF0',
    top: '#E2F2FA',
    art: () => (
      <G>
        <G opacity={0.28} fill="#14507A">
          <Path d="M10,190 C30,150 120,140 170,170 C190,182 200,196 186,204 C150,220 40,222 10,190 Z" />
          <Path d="M168,172 C180,150 200,146 214,152 C200,160 192,172 186,184 Z" />
        </G>
        <G opacity={0.5} fill="#FFFFFF">
          <Path d="M120,140 C118,126 110,118 104,114 M120,140 C122,126 130,118 136,114" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" />
        </G>
        <Circle cx={60} cy={180} r={3} fill="#FFFFFF" opacity={0.6} />
        <Path d="M300,60 Q312,52 324,60 M330,48 Q340,42 350,48" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.7} />
      </G>
    ),
  },
  sunset_sail: {
    color: '#F9C9B6',
    top: '#FDE7DA',
    art: () => (
      <G>
        <Circle cx={80} cy={150} r={44} fill="#FDBA74" opacity={0.75} />
        <Path d="M0,170 Q100,162 200,170 T400,170 L400,260 L0,260 Z" fill="#F8B4A0" />
        <Path d="M20,190 L90,190 M200,206 L290,206 M300,184 L370,184" stroke="#FFFFFF" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
        {/* a little sailboat on the right */}
        <G fill="#7C4A21" opacity={0.75}>
          <Path d="M310,164 L370,164 L360,176 L320,176 Z" />
          <Path d="M340,164 L340,104 L372,160 Z" fill="#FFF7ED" />
          <Path d="M336,164 L336,116 L312,160 Z" fill="#FFF7ED" />
        </G>
      </G>
    ),
  },
};

// The banner's main color: the header background and the wave below it
export function bannerColor(value: string | null | undefined) {
  if (!value) return '#D9E2E6';
  return SCENES[value]?.color ?? value;
}

// The scene behind a profile header (fills its parent; bleedTop extends it up
// behind whatever sits above, like the status bar). Plain colors draw nothing.
export default function BannerArt({ value, bleedTop = 0 }: { value: string | null | undefined; bleedTop?: number }) {
  const scene = value ? SCENES[value] : undefined;
  if (!scene) return null;
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { top: -bleedTop }]}
      pointerEvents="none"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
    >
      <Defs>
        <LinearGradient id="bannerSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={scene.top} />
          <Stop offset="1" stopColor={scene.color} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill="url(#bannerSky)" />
      {scene.art()}
    </Svg>
  );
}

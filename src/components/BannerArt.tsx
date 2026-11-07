import { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import AnimatedBanner, { ANIMATED_BANNERS } from './AnimatedBanner';
import { CAT } from './bannerShapes';
import { useScreenFocused } from '../lib/useScreenFocused';
import { useSettings } from '../context/SettingsContext';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Designed profile banners. A banner's value is either a plain color (the
// original banners) or one of these scene names. Scenes stay light and keep
// their artwork toward the edges, so the profile's name and bio stay readable.

// dark: a night scene, so the profile's name and bio switch to light text
type Scene = { color: string; top: string; art: () => ReactElement; dark?: boolean };

const W = 400;
const H = 260;


// --- little pieces the scenes are built from -------------------------------

const wavePath = (y: number, amp: number, period: number) => {
  let d = `M0,${y}`;
  for (let x = 0; x < W; x += period) d += ` q${period / 4},${-amp} ${period / 2},0 t${period / 2},0`;
  return `${d} L${W},${H} L0,${H} Z`;
};

function Cloud({ x, y, s = 1, opacity = 0.9 }: { x: number; y: number; s?: number; opacity?: number }) {
  return (
    <Path
      d="M0,0 C-2,-12 12,-18 20,-10 C24,-22 44,-22 48,-8 C58,-12 66,-2 60,6 L2,6 C-6,6 -6,0 0,0 Z"
      fill="#FFFFFF"
      opacity={opacity}
      transform={`translate(${x},${y}) scale(${s})`}
    />
  );
}

function Penguin({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
      <Path d="M-10,0 C-12,-20 -6,-34 0,-34 C6,-34 12,-20 10,0 C8,6 -8,6 -10,0 Z" fill="#1F2937" />
      <Path d="M-6,-2 C-8,-16 -4,-26 0,-26 C4,-26 8,-16 6,-2 C4,2 -4,2 -6,-2 Z" fill="#FFFFFF" />
      <Path d="M2,-28 L8,-26 L2,-24 Z" fill="#F59E0B" />
      <Circle cx={2} cy={-29} r={1.3} fill="#1F2937" />
      <Path d="M-4,3 L-7,6 L-1,6 Z M4,3 L1,6 L7,6 Z" fill="#F59E0B" />
      <Path d="M-10,-16 C-16,-10 -15,-4 -12,-2" fill="none" stroke="#1F2937" strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

function Palm({ x, y, s = 1, lean = 0 }: { x: number; y: number; s?: number; lean?: number }) {
  return (
    <G transform={`translate(${x},${y}) scale(${s}) rotate(${lean})`}>
      <Path d="M0,0 C-2,-30 4,-56 14,-74" stroke="#8B5A3C" strokeWidth={6} fill="none" strokeLinecap="round" />
      <G fill="#3FA796">
        <Path d="M14,-74 C-2,-86 -18,-82 -26,-72 C-12,-78 2,-76 14,-74 Z" />
        <Path d="M14,-74 C22,-90 38,-92 48,-86 C34,-86 24,-82 14,-74 Z" />
        <Path d="M14,-74 C6,-92 10,-104 18,-110 C16,-96 16,-86 14,-74 Z" />
        <Path d="M14,-74 C30,-78 42,-70 46,-60 C34,-68 24,-72 14,-74 Z" />
        <Path d="M14,-74 C0,-68 -6,-58 -6,-50 C2,-60 8,-68 14,-74 Z" />
      </G>
    </G>
  );
}

function Star({ x, y, r = 2, opacity = 0.9 }: { x: number; y: number; r?: number; opacity?: number }) {
  return <Circle cx={x} cy={y} r={r} fill="#FFFFFF" opacity={opacity} />;
}


// Merlin: a black cat in a pink collar, lying on his side
function CatLoaf({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x},${y})`}>
      <Path d={CAT.tail} stroke="#2A2533" strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d={CAT.body} fill="#2A2533" />
      <Path d={CAT.ears} fill="#2A2533" />
      <Path d={CAT.head} fill="#2A2533" />
      <Path d={CAT.sleepy} stroke="#C6E35B" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d={CAT.collar} stroke="#F472B6" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Circle cx={CAT.bell.x} cy={CAT.bell.y} r={CAT.bell.r} fill="#FACC15" />
    </G>
  );
}

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
  jellyfish: {
    color: '#C9D6F5',
    top: '#EEE6FD',
    art: () => (
      <G>
        <Path d="M40,0 L90,0 L30,260 L0,260 Z M260,0 L300,0 L340,260 L290,260 Z" fill="#FFFFFF" opacity={0.18} />
        {[
          { x: 70, y: 110, s: 1.2, c: '#F0ABFC' },
          { x: 330, y: 90, s: 1, c: '#C4B5FD' },
          { x: 250, y: 190, s: 0.7, c: '#FBCFE8' },
        ].map((j) => (
          <G key={j.x} transform={`translate(${j.x},${j.y}) scale(${j.s})`}>
            <Path
              d="M-14,2 C-18,14 -10,24 -14,38 M-5,3 C-9,18 -1,28 -5,46 M5,3 C1,18 9,28 5,46 M14,2 C10,14 18,24 14,38"
              stroke={j.c}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
            <Path d="M-22,0 C-22,-26 22,-26 22,0 Q16,5 11,0 Q5,5 0,0 Q-5,5 -11,0 Q-16,5 -22,0 Z" fill={j.c} opacity={0.6} />
          </G>
        ))}
        <G fill="#FFFFFF" opacity={0.5}>
          <Circle cx={30} cy={200} r={4} />
          <Circle cx={150} cy={140} r={3} />
          <Circle cx={200} cy={230} r={5} />
          <Circle cx={370} cy={180} r={3} />
        </G>
      </G>
    ),
  },

  // --- common ---------------------------------------------------------------
  clouds: {
    color: '#BFDDF5',
    top: '#E6F2FC',
    art: () => (
      <G>
        <Cloud x={20} y={60} s={1.3} />
        <Cloud x={300} y={40} s={1} opacity={0.8} />
        <Cloud x={330} y={150} s={1.4} />
        <Cloud x={10} y={190} s={1.1} opacity={0.8} />
      </G>
    ),
  },

  // --- uncommon -------------------------------------------------------------
  antarctica: {
    color: '#CFE8F6',
    top: '#EEF7FC',
    art: () => (
      <G>
        <Path d="M0,150 L40,96 L66,124 L96,80 L140,150 Z" fill="#FFFFFF" opacity={0.9} />
        <Path d="M96,80 L110,104 L100,100 L92,112 L84,98 Z" fill="#DCEFFA" />
        <Path d="M260,150 L300,104 L322,124 L352,90 L400,150 Z" fill="#FFFFFF" opacity={0.9} />
        <Path d="M0,150 L400,150 L400,260 L0,260 Z" fill="#9CCDE8" />
        <Path d="M20,176 L120,176 L110,192 L30,192 Z M300,206 L380,206 L372,218 L306,218 Z" fill="#FFFFFF" opacity={0.85} />
        <Path d="M40,170 L60,162 M330,200 L350,194" stroke="#FFFFFF" strokeWidth={3} opacity={0.6} />
      </G>
    ),
  },
  kelp_forest: {
    color: '#9FD8C4',
    top: '#D9F2E9',
    art: () => (
      <G strokeLinecap="round" fill="none">
        <Path d="M0,0 L50,0 L10,260 L0,260 Z" fill="#FFFFFF" opacity={0.15} />
        {[20, 50, 350, 380].map((x, i) => (
          <Path key={x} d={`M${x},260 C${x - 14},210 ${x + 14},170 ${x},${120 - i * 10} C${x - 10},90 ${x + 8},70 ${x},${40 + i * 10}`} stroke={i % 2 ? '#2F9E73' : '#3FB585'} strokeWidth={7} opacity={0.8} />
        ))}
        <G fill="#3FB585" opacity={0.8}>
          <Ellipse cx={30} cy={150} rx={8} ry={4} />
          <Ellipse cx={360} cy={110} rx={8} ry={4} />
          <Ellipse cx={372} cy={190} rx={8} ry={4} />
        </G>
        <G fill="#FFFFFF" opacity={0.6}>
          <Circle cx={90} cy={200} r={4} />
          <Circle cx={310} cy={130} r={3} />
        </G>
      </G>
    ),
  },
  beach_day: {
    color: '#A7DCEB',
    top: '#E2F5FA',
    art: () => (
      <G>
        <Circle cx={340} cy={50} r={22} fill="#FDE68A" />
        <Path d="M0,170 Q100,160 200,170 T400,170 L400,200 L0,200 Z" fill="#7CCFE0" />
        <Path d="M0,196 Q200,186 400,196 L400,260 L0,260 Z" fill="#F2D59A" />
        {/* umbrella and towel */}
        <Path d="M60,222 L74,170" stroke="#8B5A3C" strokeWidth={3} />
        <Path d="M42,176 C46,150 100,150 108,172 Z" fill="#F472B6" />
        <Path d="M60,166 L66,154 M84,170 L84,155" stroke="#FFFFFF" strokeWidth={4} />
        <Path d="M300,226 L356,218 L362,236 L306,244 Z" fill="#38BDF8" />
        <Path d="M308,230 L360,222" stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={128} cy={222} r={8} fill="#FFFFFF" />
        <Path d="M120,222 A8,8 0 0 1 136,222" fill="#EF4444" />
      </G>
    ),
  },
  lighthouse: {
    color: '#B5D6EA',
    top: '#E6F1F8',
    art: () => (
      <G>
        <Path d="M300,40 L400,20 L400,60 Z" fill="#FEF3C7" opacity={0.5} />
        <Path d="M320,210 L330,80 L356,80 L366,210 Z" fill="#FFFFFF" />
        <Path d="M324,160 L362,160 L364,180 L322,180 Z M328,110 L358,110 L359,128 L327,128 Z" fill="#EF4444" />
        <Path d="M324,80 L362,80 L360,64 L326,64 Z" fill="#334155" />
        <Rect x={330} y={52} width={26} height={14} rx={2} fill="#FDE68A" />
        <Path d="M326,52 L343,40 L360,52 Z" fill="#EF4444" />
        <Path d="M280,212 C300,196 380,194 400,206 L400,260 L270,260 Z" fill="#8FA4B3" />
        <Path d="M0,210 Q100,202 200,210 T400,210 L400,260 L0,260 Z" fill="#7CB7D6" opacity={0.8} />
        <Path d="M30,228 Q46,222 62,228 M120,240 Q136,234 152,240" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.6} />
      </G>
    ),
  },
  night_sky: {
    dark: true,
    color: '#3B4C7A',
    top: '#22305A',
    art: () => (
      <G>
        <Circle cx={340} cy={50} r={20} fill="#FEF9C3" />
        <Circle cx={350} cy={44} r={18} fill="#22305A" />
        {[
          [30, 30], [80, 70], [140, 24], [210, 50], [270, 20], [380, 100], [20, 110], [300, 90], [110, 120], [250, 130],
        ].map(([x, y], i) => (
          <Star key={i} x={x} y={y} r={i % 3 === 0 ? 2.2 : 1.4} opacity={0.85} />
        ))}
        <Path d={wavePath(200, 6, 100)} fill="#2C3C66" />
        <Path d="M330,214 L350,214 M320,226 L360,226" stroke="#FEF9C3" strokeWidth={2} opacity={0.5} />
      </G>
    ),
  },
  rain: {
    color: '#A9B8C7',
    top: '#CFD8E1',
    art: () => (
      <G>
        <Cloud x={10} y={50} s={1.6} opacity={0.75} />
        <Cloud x={280} y={40} s={1.5} opacity={0.75} />
        {Array.from({ length: 18 }, (_, i) => {
          const x = (i * 23 + 10) % 400;
          const y = 80 + ((i * 37) % 120);
          return <Path key={i} d={`M${x},${y} l-4,12`} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.6} />;
        })}
        <Path d={wavePath(220, 4, 80)} fill="#8FA4B8" />
        <Ellipse cx={60} cy={232} rx={14} ry={3} fill="none" stroke="#FFFFFF" strokeWidth={1.5} opacity={0.6} />
        <Ellipse cx={330} cy={240} rx={18} ry={4} fill="none" stroke="#FFFFFF" strokeWidth={1.5} opacity={0.6} />
      </G>
    ),
  },
  rowboat: {
    color: '#A6D8E0',
    top: '#DFF3F6',
    art: () => (
      <G>
        <Path d={wavePath(180, 5, 120)} fill="#86C7D6" />
        <Path d="M290,188 L370,188 L360,204 L300,204 Z" fill="#B45309" />
        <Path d="M296,192 L364,192" stroke="#FDE68A" strokeWidth={2} />
        <Path d="M300,196 L276,214 M352,196 L380,214" stroke="#8B5A3C" strokeWidth={3} strokeLinecap="round" />
        <Path d="M20,214 Q40,208 60,214 M100,230 Q120,224 140,230" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.6} />
        <Cloud x={30} y={60} s={1} opacity={0.8} />
      </G>
    ),
  },

  // --- rare -----------------------------------------------------------------
  penguins: {
    color: '#C6E3F2',
    top: '#EDF6FB',
    art: () => (
      <G>
        <Path d="M0,190 L120,190 L140,206 L0,206 Z M260,196 L400,196 L400,212 L280,212 Z" fill="#FFFFFF" />
        <Path d="M0,206 L140,206 L130,260 L0,260 Z M280,212 L400,212 L400,260 L290,260 Z" fill="#E4F2FA" />
        <Path d={wavePath(226, 3, 80)} fill="#8CC4E2" opacity={0.6} />
        <Penguin x={30} y={190} s={1} />
        <Penguin x={62} y={190} s={0.8} flip />
        <Penguin x={96} y={190} s={1.15} />
        <Penguin x={310} y={196} s={1.05} flip />
        <Penguin x={350} y={196} s={0.75} />
        <Penguin x={378} y={196} s={0.9} flip />
      </G>
    ),
  },
  sea_turtles: {
    color: '#9FD9D2',
    top: '#DCF3F0',
    art: () => (
      <G>
        {[
          { x: 60, y: 90, s: 1.2, r: -20 },
          { x: 340, y: 120, s: 1, r: 200 },
          { x: 300, y: 210, s: 0.7, r: 190 },
        ].map((tt, i) => (
          <G key={i} transform={`translate(${tt.x},${tt.y}) rotate(${tt.r}) scale(${tt.s})`}>
            <Path d="M-6,-10 C-14,-22 -24,-22 -28,-16 C-20,-14 -14,-10 -10,-4 Z M-6,10 C-14,22 -24,22 -28,16 C-20,14 -14,10 -10,4 Z" fill="#5EC4A6" />
            <Path d="M18,-8 C24,-14 30,-14 32,-10 L22,-4 Z M18,8 C24,14 30,14 32,10 L22,4 Z" fill="#5EC4A6" />
            <Ellipse cx={4} cy={0} rx={22} ry={15} fill="#2F9E73" />
            <Path d="M-8,-7 L4,-12 L16,-7 L16,7 L4,12 L-8,7 Z" fill="none" stroke="#1F7A57" strokeWidth={1.5} />
            <Circle cx={-24} cy={0} r={8} fill="#5EC4A6" />
          </G>
        ))}
        <G fill="#FFFFFF" opacity={0.6}>
          <Circle cx={110} cy={70} r={3} />
          <Circle cx={118} cy={56} r={2} />
        </G>
      </G>
    ),
  },
  northern_lights: {
    dark: true,
    color: '#2E4A5E',
    top: '#1A2C40',
    art: () => (
      <G>
        <Path d="M0,90 C60,40 120,110 200,60 C280,10 340,80 400,40 L400,110 C340,140 280,80 200,120 C120,160 60,90 0,140 Z" fill="#4ADE80" opacity={0.28} />
        <Path d="M0,60 C80,20 140,80 220,40 C300,0 350,50 400,20 L400,60 C340,90 300,40 220,80 C140,120 80,60 0,100 Z" fill="#A78BFA" opacity={0.22} />
        {[[30, 20], [150, 30], [260, 120], [360, 140], [90, 150]].map(([x, y], i) => (
          <Star key={i} x={x} y={y} r={1.6} opacity={0.8} />
        ))}
        <Path d="M0,210 L40,180 L70,200 L110,170 L150,210 L250,210 L290,176 L330,200 L370,172 L400,196 L400,260 L0,260 Z" fill="#14263A" />
      </G>
    ),
  },
  pirate_ship: {
    color: '#A8CFE3',
    top: '#E0EEF6',
    art: () => (
      <G>
        <Path d={wavePath(196, 6, 110)} fill="#7FB4D3" />
        <G transform="translate(300,120)">
          <Path d="M-20,74 L80,74 L70,92 L-10,92 Z" fill="#7C4A21" />
          <Path d="M28,74 L28,0 M56,74 L56,16" stroke="#7C4A21" strokeWidth={4} />
          <Path d="M10,8 C20,14 36,14 46,8 L44,40 C34,46 20,46 12,40 Z" fill="#FFF7ED" />
          <Path d="M42,24 C50,28 62,28 68,24 L66,52 C58,56 48,56 44,52 Z" fill="#FFF7ED" />
          <Path d="M28,0 L44,4 L28,8 Z" fill="#1F2937" />
          <Circle cx={28} cy={24} r={5} fill="#1F2937" />
        </G>
        <Path d="M20,220 Q40,214 60,220 M100,236 Q120,230 140,236" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.6} />
      </G>
    ),
  },
  balloons: {
    color: '#F6D2C4',
    top: '#FCEDE6',
    art: () => (
      <G>
        {[
          { x: 50, y: 70, s: 1.1, c: '#F472B6', b: '#FDE68A' },
          { x: 340, y: 60, s: 1, c: '#38BDF8', b: '#FFFFFF' },
          { x: 370, y: 160, s: 0.7, c: '#FB923C', b: '#FDE68A' },
          { x: 30, y: 180, s: 0.6, c: '#A78BFA', b: '#FFFFFF' },
        ].map((b, i) => (
          <G key={i} transform={`translate(${b.x},${b.y}) scale(${b.s})`}>
            <Path d="M0,-30 C20,-30 26,-10 18,8 C14,16 6,22 4,26 L-4,26 C-6,22 -14,16 -18,8 C-26,-10 -20,-30 0,-30 Z" fill={b.c} />
            <Path d="M0,-30 C8,-30 10,-10 6,10 C4,18 2,22 2,26 L-2,26 C-2,22 -4,18 -6,10 C-10,-10 -8,-30 0,-30 Z" fill={b.b} opacity={0.7} />
            <Path d="M-4,26 L-5,34 M4,26 L5,34" stroke="#7C4A21" strokeWidth={1.2} />
            <Rect x={-6} y={33} width={12} height={8} rx={1.5} fill="#B45309" />
          </G>
        ))}
        <Cloud x={130} y={210} s={1.2} />
      </G>
    ),
  },
  shipwreck: {
    color: '#8EBFCF',
    top: '#C9E3EB',
    art: () => (
      <G>
        <Path d="M60,0 L110,0 L40,260 L10,260 Z" fill="#FFFFFF" opacity={0.12} />
        <Path d="M0,220 Q100,206 200,220 T400,220 L400,260 L0,260 Z" fill="#E9D3A4" />
        <G transform="translate(270,140) rotate(-12)" opacity={0.75}>
          <Path d="M0,60 L110,60 L96,86 L12,86 Z" fill="#5B4636" />
          <Path d="M40,60 L46,0 M80,60 L76,20" stroke="#5B4636" strokeWidth={4} />
          <Path d="M46,6 C56,12 66,12 72,8 L70,30 C62,34 52,34 46,28 Z" fill="#D8CBB5" opacity={0.7} />
        </G>
        <Path d="M20,222 L20,190 M20,204 L10,194 M40,222 C36,206 46,198 42,186" stroke="#3FB585" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
        <G fill="#FFFFFF" opacity={0.5}>
          <Circle cx={300} cy={110} r={3} />
          <Circle cx={308} cy={94} r={2} />
        </G>
      </G>
    ),
  },

  // --- epic -----------------------------------------------------------------
  manta: {
    color: '#7FB5D8',
    top: '#BFDDF0',
    art: () => (
      <G>
        <Path d="M40,0 L90,0 L30,260 L0,260 Z M300,0 L340,0 L380,260 L330,260 Z" fill="#FFFFFF" opacity={0.15} />
        {[
          { x: 330, y: 100, r: 20, s: 1 },
          { x: 70, y: 180, r: -25, s: 0.6 },
        ].map((m, i) => (
          <G key={i} transform={`translate(${m.x},${m.y}) rotate(${m.r}) scale(${m.s})`} opacity={0.55}>
            {/* seen from above: wide wings, little head lobes, a long thin tail */}
            <Path d="M0,-18 C-20,-20 -48,-10 -70,6 C-46,8 -22,14 -8,24 L0,30 L8,24 C22,14 46,8 70,6 C48,-10 20,-20 0,-18 Z" fill="#1E3A5F" />
            <Path d="M-8,-18 L-12,-28 L-3,-20 Z M8,-18 L12,-28 L3,-20 Z" fill="#1E3A5F" />
            <Path d="M0,28 C2,46 -2,62 4,80" stroke="#1E3A5F" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </G>
        ))}
      </G>
    ),
  },
  volcano: {
    color: '#F2B6A0',
    top: '#FCE1D6',
    art: () => (
      <G>
        <Path d="M300,40 C290,20 310,6 320,18 C330,0 356,8 350,26 C366,26 366,44 352,46 Z" fill="#9CA3AF" opacity={0.6} />
        <Path d="M240,200 L310,80 L340,80 L400,190 L400,200 Z" fill="#7C4A3A" />
        <Path d="M310,80 L340,80 L334,100 L326,92 L318,108 L314,94 Z" fill="#F97316" />
        <Path d="M0,196 Q100,188 200,196 T400,196 L400,260 L0,260 Z" fill="#7CCFE0" />
        <Palm x={60} y={200} s={0.8} lean={-6} />
        <Path d="M20,202 C40,190 110,190 130,204 Z" fill="#F2D59A" />
      </G>
    ),
  },
  submarine: {
    color: '#88C4D9',
    top: '#C7E6F0',
    art: () => (
      <G>
        <G transform="translate(320,120)">
          <Rect x={-50} y={-16} width={100} height={36} rx={18} fill="#FACC15" />
          <Rect x={-16} y={-36} width={34} height={22} rx={6} fill="#FACC15" />
          <Path d="M2,-36 L2,-50 L14,-50" stroke="#475569" strokeWidth={3} fill="none" />
          {[-28, -6, 16].map((x) => (
            <Circle key={x} cx={x} cy={2} r={6} fill="#BAE6FD" stroke="#CA8A04" strokeWidth={2} />
          ))}
          <Path d="M50,2 L62,-8 L62,12 Z" fill="#CA8A04" />
        </G>
        <G fill="#FFFFFF" opacity={0.6}>
          <Circle cx={250} cy={110} r={4} />
          <Circle cx={240} cy={96} r={3} />
          <Circle cx={232} cy={84} r={2} />
        </G>
        <Path d="M0,230 Q100,218 200,230 T400,230 L400,260 L0,260 Z" fill="#E9D3A4" />
        <Path d="M30,232 L30,204 M30,216 L20,206 M60,232 C56,218 66,210 62,198" stroke="#FB7185" strokeWidth={5} fill="none" strokeLinecap="round" />
      </G>
    ),
  },
  lanterns: {
    dark: true,
    color: '#3E3A6B',
    top: '#2A2650',
    art: () => (
      <G>
        <Path d={wavePath(210, 5, 100)} fill="#2F2B58" />
        {[
          [40, 60, 1], [90, 110, 0.8], [30, 150, 0.7], [340, 50, 1.1], [300, 120, 0.8], [370, 160, 0.7], [140, 40, 0.6], [250, 70, 0.6],
        ].map(([x, y, s], i) => (
          <G key={i} transform={`translate(${x},${y}) scale(${s})`}>
            <Circle cx={0} cy={0} r={18} fill="#FDBA74" opacity={0.25} />
            <Path d="M-8,-12 L8,-12 L10,10 L-10,10 Z" fill="#FB923C" />
            <Path d="M-6,-8 L6,-8 L7,6 L-7,6 Z" fill="#FDE68A" opacity={0.8} />
          </G>
        ))}
        <Path d="M30,226 L50,226 M320,232 L344,232" stroke="#FDBA74" strokeWidth={2} opacity={0.5} />
      </G>
    ),
  },

  // --- legendary (these move on profiles, see AnimatedBanner) ----------------
  angler: {
    dark: true,
    color: '#16314F',
    top: '#0B1C33',
    art: () => (
      <G>
        <Circle cx={250} cy={120} r={30} fill="#FEF9C3" opacity={0.18} />
        <Path d="M300,150 C292,120 272,112 254,120" stroke="#64748B" strokeWidth={2} fill="none" />
        <Circle cx={252} cy={120} r={6} fill="#FDE047" />
        <Path d="M290,160 C300,126 370,124 384,160 C370,196 300,196 290,168 Z" fill="#334155" />
        <Path d="M292,162 L300,156 L304,166 L310,157 L314,167 L320,158 L324,168" stroke="#FFFFFF" strokeWidth={2} fill="none" />
        <Circle cx={330} cy={146} r={6} fill="#FDE047" />
        <Circle cx={331} cy={147} r={2.5} fill="#0B1C33" />
        <Path d="M384,160 L398,146 L398,174 Z" fill="#334155" />
        <G transform="translate(140,110)">
          <Path d="M-10,0 C-4,-6 6,-6 10,0 C6,6 -4,6 -10,0 Z M-10,0 L-16,-5 L-16,5 Z" fill="#FB923C" />
        </G>
        {[[30, 40], [80, 200], [180, 30], [370, 60], [60, 120]].map(([x, y], i) => (
          <Star key={i} x={x} y={y} r={1.3} opacity={0.5} />
        ))}
      </G>
    ),
  },
  cat_fish: {
    color: '#C7DDEA',
    top: '#E8F1F7',
    art: () => (
      <G>
        <CatLoaf x={34} y={214} />
        <Path d="M0,226 L400,226 L400,260 L0,260 Z" fill="#E9D3A4" />
        <G transform="translate(300,90)">
          <Path d="M-14,0 C-6,-9 8,-9 14,0 C8,9 -6,9 -14,0 Z M-14,0 L-22,-7 L-22,7 Z" fill="#F97316" />
          <Circle cx={8} cy={-2} r={1.6} fill="#1F2937" />
        </G>
        <G fill="#FFFFFF" opacity={0.6}>
          <Circle cx={320} cy={70} r={3} />
          <Circle cx={326} cy={58} r={2} />
        </G>
      </G>
    ),
  },
  glow_bay: {
    dark: true,
    color: '#1E3A5C',
    top: '#10233D',
    art: () => (
      <G>
        {[[40, 30], [120, 60], [200, 20], [300, 50], [370, 30], [80, 100], [330, 110]].map(([x, y], i) => (
          <Star key={i} x={x} y={y} r={1.4} opacity={0.8} />
        ))}
        <Path d={wavePath(180, 6, 100)} fill="#173253" />
        <Path d="M0,186 Q50,178 100,186 T200,186 T300,186 T400,186" stroke="#5EEAD4" strokeWidth={3} fill="none" opacity={0.8} />
        <Path d="M0,210 Q50,202 100,210 T200,210 T300,210 T400,210" stroke="#38BDF8" strokeWidth={2} fill="none" opacity={0.5} />
        {[[40, 230], [90, 200], [330, 222], [370, 196], [260, 240]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.4} fill="#5EEAD4" opacity={0.8} />
        ))}
      </G>
    ),
  },
  koi_pond: {
    color: '#9FD6C8',
    top: '#D8F0EA',
    art: () => (
      <G>
        <G fill="#3FB585" opacity={0.85}>
          <Path d="M10,40 C10,18 50,18 50,40 C50,62 10,62 10,40 Z M30,40 L50,32 L50,48 Z" />
          <Path d="M340,200 C340,178 380,178 380,200 C380,222 340,222 340,200 Z" />
          <Path d="M360,40 C360,26 384,26 384,40 C384,54 360,54 360,40 Z" />
        </G>
        <Path d="M30,40 L50,32 L50,48 Z" fill="#9FD6C8" />
        <Circle cx={360} cy={196} r={6} fill="#F9A8D4" />
        <G transform="translate(80,180) rotate(-20)">
          <Path d="M-18,0 C-10,-10 10,-10 20,0 C10,10 -10,10 -18,0 Z M-16,0 L-28,-8 L-25,0 L-28,8 Z" fill="#FB923C" />
          <Path d="M-4,-6 C0,-8 6,-6 6,-2 C2,-2 -2,-3 -4,-6 Z" fill="#FFFFFF" />
        </G>
        <G transform="translate(320,90) rotate(160)">
          <Path d="M-18,0 C-10,-10 10,-10 20,0 C10,10 -10,10 -18,0 Z M-16,0 L-28,-8 L-25,0 L-28,8 Z" fill="#FFFFFF" />
          <Path d="M-4,-6 C0,-8 6,-6 6,-2 C2,-2 -2,-3 -4,-6 Z" fill="#F97316" />
        </G>
      </G>
    ),
  },
  starfall: {
    dark: true,
    color: '#2F3E6E',
    top: '#1A2448',
    art: () => (
      <G>
        {[[30, 30], [90, 60], [160, 20], [240, 40], [310, 20], [380, 70], [50, 120], [350, 130]].map(([x, y], i) => (
          <Star key={i} x={x} y={y} r={i % 2 ? 1.2 : 2} opacity={0.85} />
        ))}
        <Path d="M60,40 L110,70" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <Path d="M300,60 L340,84" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        <Path d={wavePath(200, 5, 100)} fill="#25335E" />
        <Path d="M60,214 L90,214 M300,224 L336,224" stroke="#FFFFFF" strokeWidth={2} opacity={0.4} />
      </G>
    ),
  },

};

// Night scenes: text over them should be light
export function bannerIsDark(value: string | null | undefined) {
  return !!(value && SCENES[value]?.dark);
}

// Style overrides for a profile header sitting on a night scene
export const ON_DARK = {
  title: { color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.35)' },
  text: { color: '#D6E2F0' },
  icon: '#FFFFFF',
} as const;

// The banner's main color: the header background and the wave below it
export function bannerColor(value: string | null | undefined) {
  if (!value) return '#D9E2E6';
  // a plain color, or a scene; anything else (a retired scene) gets the default
  return SCENES[value]?.color ?? (value.startsWith('#') ? value : '#D9E2E6');
}

// The scene behind a profile header (fills its parent; bleedTop extends it up
// behind whatever sits above, like the status bar). Plain colors draw nothing.
// animated: legendary scenes move (on full-size headers; tiles stay still),
// unless the screen is hidden, motion is reduced, or animations are off.
export default function BannerArt({
  value,
  bleedTop = 0,
  animated = false,
}: {
  value: string | null | undefined;
  bleedTop?: number;
  animated?: boolean;
}) {
  const focused = useScreenFocused();
  const reduceMotion = useReducedMotion();
  const { settings } = useSettings();
  const scene = value ? SCENES[value] : undefined;
  if (!scene || !value) return null;
  if (animated && focused && !reduceMotion && settings.animations && ANIMATED_BANNERS.includes(value)) {
    return <AnimatedBanner value={value} bleedTop={bleedTop} />;
  }
  return (
    <Svg
      key={value}
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

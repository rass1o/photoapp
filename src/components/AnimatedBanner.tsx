import { ReactElement, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle as SkCircle,
  Group as SkGroup,
  LinearGradient as SkLinearGradient,
  Path as SkPath,
  Rect as SkRect,
  vec,
} from '@shopify/react-native-skia';
import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { CAT } from './bannerShapes';

// Legendary banners that move: drawn with Skia and driven by one looping
// clock, so the whole scene costs a single canvas. Same 400x260 scene and
// "cover, anchored to the bottom" fit as the still versions in BannerArt.

const W = 400;
const H = 260;
const LOOP_MS = 12000;

export const ANIMATED_BANNERS = ['sunset_sail', 'jellyfish', 'angler', 'cat_fish', 'glow_bay', 'koi_pond', 'starfall'];

// A wave band: its top edge ripples, and it's drawn two periods wide so it
// can slide sideways and loop without a seam
function waveBand(top: number, amp: number, period: number) {
  let d = `M0,${top}`;
  for (let x = 0; x < W + period * 2; x += period) {
    d += ` Q${x + period / 4},${top - amp} ${x + period / 2},${top} Q${x + (period * 3) / 4},${top + amp} ${x + period},${top}`;
  }
  return `${d} L${W + period * 2},${H} L0,${H} Z`;
}

const SUN = { x: 80, y: 150 };
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 12;
  const p = (r: number, off: number) => `${SUN.x + r * Math.cos(a + off)},${SUN.y + r * Math.sin(a + off)}`;
  return `M${p(52, -0.09)} L${p(70, 0)} L${p(52, 0.09)} Z`;
}).join(' ');

function SunsetSail({ t }: { t: SharedValue<number> }) {
  const sun = useDerivedValue(() => [{ rotate: t.value * Math.PI }]);
  const backWave = useDerivedValue(() => [{ translateX: -((t.value * 3) % 1) * 130 }]);
  const frontWave = useDerivedValue(() => [{ translateX: -(1 - ((t.value * 4) % 1)) * 100 }]);
  const boat = useDerivedValue(() => {
    const a = t.value * Math.PI * 2 * 3;
    return [{ translateY: Math.sin(a) * 2 }, { rotate: Math.sin(a) * 0.07 }];
  });

  return (
    <SkGroup>
      <SkRect x={0} y={0} width={W} height={H}>
        <SkLinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['#FDE7DA', '#F9C9B6']} />
      </SkRect>
      <SkGroup transform={sun} origin={vec(SUN.x, SUN.y)}>
        <SkPath path={RAYS} color="#FDBA74" opacity={0.55} />
      </SkGroup>
      <SkCircle cx={SUN.x} cy={SUN.y} r={44} color="#FDBA74" opacity={0.8} />
      <SkGroup transform={backWave}>
        <SkPath path={waveBand(170, 6, 130)} color="#F8B4A0" />
      </SkGroup>
      {/* the sailboat rocks on its keel */}
      <SkGroup transform={boat} origin={vec(340, 172)}>
        <SkGroup opacity={0.85}>
          <SkPath path="M310,164 L370,164 L360,176 L320,176 Z" color="#7C4A21" />
          <SkPath path="M340,164 L340,104 L372,160 Z" color="#FFF7ED" />
          <SkPath path="M336,164 L336,116 L312,160 Z" color="#FFF7ED" />
          <SkPath path="M339,104 L341,104 L341,164 L339,164 Z" color="#7C4A21" />
        </SkGroup>
      </SkGroup>
      <SkGroup transform={frontWave}>
        <SkPath path={waveBand(196, 5, 100)} color="#F49C84" opacity={0.6} />
      </SkGroup>
    </SkGroup>
  );
}

// A jellyfish: a translucent bell with tentacles that sway as it drifts
const BELL = 'M-22,0 C-22,-26 22,-26 22,0 Q16,5 11,0 Q5,5 0,0 Q-5,5 -11,0 Q-16,5 -22,0 Z';
const TENTACLES = 'M-14,2 C-18,14 -10,24 -14,38 M-5,3 C-9,18 -1,28 -5,46 M5,3 C1,18 9,28 5,46 M14,2 C10,14 18,24 14,38';

const JELLIES = [
  { x: 70, y: 110, scale: 1.2, phase: 0, color: '#F0ABFC' },
  { x: 330, y: 90, scale: 1, phase: 2, color: '#C4B5FD' },
  { x: 250, y: 190, scale: 0.7, phase: 4, color: '#FBCFE8' },
];

function Jelly({ t, x, y, scale, phase, color }: { t: SharedValue<number> } & (typeof JELLIES)[number]) {
  const drift = useDerivedValue(() => {
    const a = t.value * Math.PI * 2 * 2 + phase;
    return [{ translateX: x }, { translateY: y + Math.sin(a) * 8 }, { scale }];
  });
  const sway = useDerivedValue(() => [{ skewX: Math.sin(t.value * Math.PI * 2 * 3 + phase) * 0.25 }]);
  return (
    <SkGroup transform={drift}>
      <SkGroup transform={sway}>
        <SkPath path={TENTACLES} style="stroke" strokeWidth={2.5} strokeCap="round" color={color} opacity={0.7} />
      </SkGroup>
      <SkPath path={BELL} color={color} opacity={0.6} />
      <SkPath path="M-14,-10 Q-8,-18 0,-19" style="stroke" strokeWidth={2.5} strokeCap="round" color="#FFFFFF" opacity={0.6} />
    </SkGroup>
  );
}

const BUBBLES = [
  { x: 30, r: 4, speed: 2, offset: 0 },
  { x: 150, r: 3, speed: 3, offset: 0.4 },
  { x: 200, r: 5, speed: 2, offset: 0.7 },
  { x: 370, r: 3, speed: 3, offset: 0.2 },
  { x: 290, r: 4, speed: 2, offset: 0.55 },
];

function Bubble({ t, x, r, speed, offset }: { t: SharedValue<number> } & (typeof BUBBLES)[number]) {
  const cy = useDerivedValue(() => H + 10 - ((t.value * speed + offset) % 1) * (H + 20));
  const cx = useDerivedValue(() => x + Math.sin((t.value * speed + offset) * Math.PI * 6) * 4);
  return <SkCircle cx={cx} cy={cy} r={r} color="#FFFFFF" opacity={0.5} />;
}

function Jellyfish({ t }: { t: SharedValue<number> }) {
  return (
    <SkGroup>
      <SkRect x={0} y={0} width={W} height={H}>
        <SkLinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['#EEE6FD', '#C9D6F5']} />
      </SkRect>
      <SkPath path="M40,0 L90,0 L30,260 L0,260 Z M260,0 L300,0 L340,260 L290,260 Z" color="#FFFFFF" opacity={0.18} />
      {BUBBLES.map((b) => (
        <Bubble key={b.x} t={t} {...b} />
      ))}
      {JELLIES.map((j) => (
        <Jelly key={j.x} t={t} {...j} />
      ))}
    </SkGroup>
  );
}


// --- shared bits for the newer scenes ---------------------------------------

const TAU = Math.PI * 2;

function Sky({ top, bottom }: { top: string; bottom: string }) {
  return (
    <SkRect x={0} y={0} width={W} height={H}>
      <SkLinearGradient start={vec(0, 0)} end={vec(0, H)} colors={[top, bottom]} />
    </SkRect>
  );
}

function Twinkle({ t, x, y, r, phase }: { t: SharedValue<number>; x: number; y: number; r: number; phase: number }) {
  const opacity = useDerivedValue(() => 0.35 + 0.55 * Math.abs(Math.sin(t.value * TAU * 4 + phase)));
  return <SkCircle cx={x} cy={y} r={r} color="#FFFFFF" opacity={opacity} />;
}

const STARS = [
  [30, 30, 1.6], [90, 60, 1.2], [160, 20, 2], [240, 40, 1.3], [310, 22, 1.8], [380, 70, 1.2], [50, 120, 1.4], [350, 130, 1.6], [120, 100, 1.1],
] as const;

// A fish pointing right at the origin
const FISH = 'M-12,0 C-5,-8 7,-8 12,0 C7,8 -5,8 -12,0 Z M-11,0 L-19,-6 L-19,6 Z';

// Something swimming round an oval: placed on it, and facing the way it's going
function useSwim(t: SharedValue<number>, laps: number, cx: number, cy: number, rx: number, ry: number, lag: number, scale = 1) {
  return useDerivedValue(() => {
    const a = t.value * TAU * laps - lag;
    const dx = -Math.sin(a);
    return [
      { translateX: cx + rx * Math.cos(a) },
      { translateY: cy + ry * Math.sin(a) },
      // turn round smoothly when it changes direction
      { scaleX: scale * Math.max(-1, Math.min(1, dx * 4)) },
      { scaleY: scale },
    ];
  });
}

// --- anglerfish chasing a little fish ---------------------------------------

function Angler({ t }: { t: SharedValue<number> }) {
  const fish = useSwim(t, 2, 200, 140, 150, 50, 0);
  const angler = useSwim(t, 2, 200, 140, 150, 50, 0.9, 0.8);
  // the bulb flickers, with the odd dip
  const bulb = useDerivedValue(() => {
    const flick = Math.abs(Math.sin(t.value * TAU * 9));
    const dip = Math.sin(t.value * TAU * 2.3) < -0.75 ? 0.35 : 1;
    return (0.55 + 0.45 * flick) * dip;
  });
  const glow = useDerivedValue(() => bulb.value * 0.35);
  return (
    <SkGroup>
      <Sky top="#0B1C33" bottom="#16314F" />
      {STARS.map(([x, y, r], i) => (
        <SkCircle key={i} cx={x} cy={y} r={r * 0.8} color="#FFFFFF" opacity={0.35} />
      ))}
      <SkGroup transform={fish}>
        <SkPath path={FISH} color="#FB923C" />
        <SkCircle cx={7} cy={-2} r={1.4} color="#1F2937" />
      </SkGroup>
      <SkGroup transform={angler}>
        <SkCircle cx={66} cy={-32} r={24} color="#FEF9C3" opacity={glow} />
        <SkPath path="M14,-24 C26,-52 56,-54 66,-36" style="stroke" strokeWidth={2.5} color="#64748B" />
        <SkPath path="M-34,0 L-52,-16 L-50,0 L-52,16 Z" color="#334155" />
        <SkPath path="M-36,0 C-26,-38 48,-40 60,0 C48,38 -26,38 -36,0 Z" color="#334155" />
        <SkPath path="M30,6 L36,-2 L40,8 L46,-1 L50,9 L56,0" style="stroke" strokeWidth={2.5} color="#FFFFFF" />
        <SkCircle cx={30} cy={-12} r={6} color="#FDE047" />
        <SkCircle cx={31} cy={-11} r={2.6} color="#0B1C33" />
        <SkCircle cx={66} cy={-32} r={6} color="#FDE047" opacity={bulb} />
      </SkGroup>
    </SkGroup>
  );
}

// --- a cat watching a fish swim round ---------------------------------------

const CAT_AT = { x: 34, y: 214 };

function CatFish({ t }: { t: SharedValue<number> }) {
  const fishAngle = useDerivedValue(() => t.value * TAU * 2);
  const fish = useSwim(t, 2, 210, 110, 170, 60, 0);
  // the head comes up as the fish swims past the cat's end, then settles
  const lift = useDerivedValue(() => {
    const x = 210 + 170 * Math.cos(fishAngle.value);
    const v = Math.max(0, Math.min(1, (200 - x) / 90));
    return v * v * (3 - 2 * v);
  });
  const head = useDerivedValue(() => [{ translateY: -lift.value * 8 }, { rotate: -lift.value * 0.35 }]);
  const asleep = useDerivedValue(() => 1 - lift.value);
  return (
    <SkGroup>
      <Sky top="#E8F1F7" bottom="#C7DDEA" />
      <SkRect x={0} y={226} width={W} height={H - 226} color="#E9D3A4" />
      <SkGroup transform={[{ translateX: CAT_AT.x }, { translateY: CAT_AT.y }]}>
        <SkPath path={CAT.tail} style="stroke" strokeWidth={6} strokeCap="round" color="#2A2533" />
        <SkPath path={CAT.body} color="#2A2533" />
        <SkGroup transform={head} origin={vec(66, -6)}>
          <SkPath path={CAT.ears} color="#2A2533" />
          <SkPath path={CAT.head} color="#2A2533" />
          <SkPath path={CAT.sleepy} style="stroke" strokeWidth={1.6} strokeCap="round" color="#C6E35B" opacity={asleep} />
          <SkGroup opacity={lift}>
            <SkCircle cx={75} cy={-14} r={2.6} color="#C6E35B" />
            <SkCircle cx={85} cy={-14} r={2.6} color="#C6E35B" />
            <SkCircle cx={75} cy={-14} r={1.1} color="#111111" />
            <SkCircle cx={85} cy={-14} r={1.1} color="#111111" />
          </SkGroup>
        </SkGroup>
        <SkPath path={CAT.collar} style="stroke" strokeWidth={3.5} strokeCap="round" color="#F472B6" />
        <SkCircle cx={CAT.bell.x} cy={CAT.bell.y} r={CAT.bell.r} color="#FACC15" />
      </SkGroup>
      <SkGroup transform={fish}>
        <SkPath path={FISH} color="#F97316" />
        <SkCircle cx={7} cy={-2} r={1.4} color="#1F2937" />
      </SkGroup>
    </SkGroup>
  );
}

// --- a bay of glowing waves ------------------------------------------------

function GlowBay({ t }: { t: SharedValue<number> }) {
  const front = useDerivedValue(() => [{ translateX: -((t.value * 3) % 1) * 100 }]);
  const back = useDerivedValue(() => [{ translateX: -(1 - ((t.value * 2) % 1)) * 100 }]);
  const pulse = useDerivedValue(() => 0.45 + 0.4 * Math.abs(Math.sin(t.value * TAU * 3)));
  return (
    <SkGroup>
      <Sky top="#10233D" bottom="#1E3A5C" />
      {STARS.map(([x, y, r], i) => (
        <Twinkle key={i} t={t} x={x} y={y * 0.9} r={r} phase={i * 1.7} />
      ))}
      <SkPath path={waveBand(180, 6, 100)} color="#173253" />
      <SkGroup transform={back}>
        <SkPath path={waveLine(210, 4, 100)} style="stroke" strokeWidth={2} color="#38BDF8" opacity={0.5} />
      </SkGroup>
      <SkGroup transform={front} opacity={pulse}>
        <SkPath path={waveLine(186, 5, 100)} style="stroke" strokeWidth={3} color="#5EEAD4" />
      </SkGroup>
      {[[40, 230], [90, 200], [330, 222], [370, 196], [260, 240]].map(([x, y], i) => (
        <Twinkle key={`g${i}`} t={t} x={x} y={y} r={2.4} phase={i * 2.1} />
      ))}
    </SkGroup>
  );
}

// --- two koi circling a pond -----------------------------------------------

const KOI = 'M-18,0 C-10,-10 10,-10 20,0 C10,10 -10,10 -18,0 Z M-16,0 L-28,-8 L-25,0 L-28,8 Z';
const KOI_SPOT = 'M-4,-6 C0,-8 6,-6 6,-2 C2,-2 -2,-3 -4,-6 Z';

function Koi({ t, phase, body, spot }: { t: SharedValue<number>; phase: number; body: string; spot: string }) {
  const move = useDerivedValue(() => {
    const a = t.value * TAU * 1.5 + phase;
    // heading along the oval, so it always swims nose first
    const heading = Math.atan2(70 * Math.cos(a), -160 * Math.sin(a));
    return [{ translateX: 200 + 160 * Math.cos(a) }, { translateY: 130 + 70 * Math.sin(a) }, { rotate: heading }];
  });
  return (
    <SkGroup transform={move}>
      <SkPath path={KOI} color={body} />
      <SkPath path={KOI_SPOT} color={spot} />
    </SkGroup>
  );
}

function KoiPond({ t }: { t: SharedValue<number> }) {
  return (
    <SkGroup>
      <Sky top="#D8F0EA" bottom="#9FD6C8" />
      <SkPath path="M10,40 C10,18 50,18 50,40 C50,62 10,62 10,40 Z M340,200 C340,178 380,178 380,200 C380,222 340,222 340,200 Z M360,40 C360,26 384,26 384,40 C384,54 360,54 360,40 Z" color="#3FB585" opacity={0.85} />
      <SkCircle cx={360} cy={196} r={6} color="#F9A8D4" />
      <Koi t={t} phase={0} body="#FB923C" spot="#FFFFFF" />
      <Koi t={t} phase={Math.PI} body="#FFFFFF" spot="#F97316" />
    </SkGroup>
  );
}

// --- shooting stars ---------------------------------------------------------

function ShootingStar({ t, x, y, offset }: { t: SharedValue<number>; x: number; y: number; offset: number }) {
  const p = useDerivedValue(() => (t.value * 2 + offset) % 1);
  // each one streaks across in the first fifth of its cycle, then waits
  const move = useDerivedValue(() => [{ translateX: x + Math.min(p.value / 0.2, 1) * 90 }, { translateY: y + Math.min(p.value / 0.2, 1) * 50 }]);
  const opacity = useDerivedValue(() => (p.value < 0.2 ? Math.sin((p.value / 0.2) * Math.PI) : 0));
  return (
    <SkGroup transform={move} opacity={opacity}>
      <SkPath path="M0,0 L-40,-22" style="stroke" strokeWidth={2} strokeCap="round" color="#FFFFFF" />
      <SkCircle cx={0} cy={0} r={2.4} color="#FFFFFF" />
    </SkGroup>
  );
}

function Starfall({ t }: { t: SharedValue<number> }) {
  return (
    <SkGroup>
      <Sky top="#1A2448" bottom="#2F3E6E" />
      {STARS.map(([x, y, r], i) => (
        <Twinkle key={i} t={t} x={x} y={y} r={r} phase={i * 1.3} />
      ))}
      <ShootingStar t={t} x={50} y={30} offset={0} />
      <ShootingStar t={t} x={270} y={50} offset={0.35} />
      <ShootingStar t={t} x={140} y={10} offset={0.7} />
      <SkPath path={waveBand(200, 5, 100)} color="#25335E" />
    </SkGroup>
  );
}

// Just the line of a wave (no fill), drawn two periods wide like waveBand
function waveLine(top: number, amp: number, period: number) {
  let d = `M0,${top}`;
  for (let x = 0; x < W + period * 2; x += period) {
    d += ` Q${x + period / 4},${top - amp} ${x + period / 2},${top} Q${x + (period * 3) / 4},${top + amp} ${x + period},${top}`;
  }
  return d;
}

const SCENES: Record<string, (props: { t: SharedValue<number> }) => ReactElement> = {
  sunset_sail: SunsetSail,
  jellyfish: Jellyfish,
  angler: Angler,
  cat_fish: CatFish,
  glow_bay: GlowBay,
  koi_pond: KoiPond,
  starfall: Starfall,
};

// Fills its parent (bleedTop extends it up behind the status bar, like BannerArt)
export default function AnimatedBanner({ value, bleedTop = 0 }: { value: string; bleedTop?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  // Cover the box and sit on its bottom edge, like preserveAspectRatio xMidYMax slice
  const scale = Math.max(size.width / W, size.height / H);
  const fit = [{ translateX: (size.width - W * scale) / 2 }, { translateY: size.height - H * scale }, { scale }];

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { top: -bleedTop }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <Canvas style={{ width: size.width, height: size.height }}>
          <SkGroup transform={fit}>
            {(() => {
              const Scene = SCENES[value] ?? Jellyfish;
              return <Scene t={t} />;
            })()}
          </SkGroup>
        </Canvas>
      )}
    </View>
  );
}

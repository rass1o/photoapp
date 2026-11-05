import { useEffect, useState } from 'react';
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

// Legendary banners that move: drawn with Skia and driven by one looping
// clock, so the whole scene costs a single canvas. Same 400x260 scene and
// "cover, anchored to the bottom" fit as the still versions in BannerArt.

const W = 400;
const H = 260;
const LOOP_MS = 12000;

export const ANIMATED_BANNERS = ['sunset_sail', 'jellyfish'];

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
            {value === 'sunset_sail' ? <SunsetSail t={t} /> : <Jellyfish t={t} />}
          </SkGroup>
        </Canvas>
      )}
    </View>
  );
}

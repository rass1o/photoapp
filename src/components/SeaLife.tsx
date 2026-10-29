import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Little ripples drawn on the water: [left, top, width]
const RIPPLES: Array<[`${number}%`, number, number]> = [
  ['5%', 14, 34],
  ['60%', 6, 26],
  ['36%', 54, 30],
  ['82%', 92, 28],
  ['12%', 118, 24],
  ['50%', 150, 32],
];

function Ripple({ width }: { width: number }) {
  return (
    <Svg width={width} height={8} viewBox="0 0 30 8">
      <Path
        d="M1,5 Q5.5,1 10,5 T19,5 T28,5"
        stroke={colors.white}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
    </Svg>
  );
}

function Turtle() {
  return (
    <Svg width={52} height={36} viewBox="0 0 60 40">
      <G stroke={colors.abyss} strokeWidth={2} strokeLinejoin="round">
        {/* flippers */}
        <Ellipse cx={20} cy={8} rx={9} ry={4.5} fill="#5FB58A" rotation={-35} origin="20, 8" />
        <Ellipse cx={38} cy={7} rx={10} ry={4.5} fill="#5FB58A" rotation={30} origin="38, 7" />
        <Ellipse cx={18} cy={32} rx={8} ry={4} fill="#5FB58A" rotation={35} origin="18, 32" />
        <Ellipse cx={38} cy={33} rx={9} ry={4} fill="#5FB58A" rotation={-30} origin="38, 33" />
        <Path d="M9,20 L3,18 L4,23 Z" fill="#5FB58A" />
        {/* head */}
        <Ellipse cx={50} cy={20} rx={7.5} ry={6} fill="#5FB58A" />
        {/* shell */}
        <Ellipse cx={28} cy={20} rx={18} ry={13} fill="#3E8E6A" />
        <Path
          d="M28,9 L33,15 L28,21 L23,15 Z M28,21 L33,27 M28,21 L23,27 M33,15 L42,17 M23,15 L14,17"
          fill="none"
          stroke="#2B6B4F"
          strokeWidth={1.5}
        />
      </G>
      <Circle cx={52.5} cy={18.5} r={1.4} fill={colors.ink} />
    </Svg>
  );
}

function Fish({ color = colors.coral }: { color?: string }) {
  return (
    <Svg width={26} height={16} viewBox="0 0 30 18">
      <G stroke={colors.abyss} strokeWidth={1.6} strokeLinejoin="round">
        <Path d="M6,9 L0,3 L0,15 Z" fill={color} />
        <Ellipse cx={16} cy={9} rx={11} ry={7} fill={color} />
        <Path d="M14,2.5 Q16,6 14,15.5" fill="none" stroke={colors.white} strokeWidth={1.2} opacity={0.7} />
      </G>
      <Circle cx={22} cy={7.5} r={1.4} fill={colors.ink} />
    </Svg>
  );
}

function Bubbles() {
  return (
    <Svg width={18} height={26} viewBox="0 0 18 26">
      <G stroke={colors.white} strokeWidth={1.3} fill="none" opacity={0.75}>
        <Circle cx={6} cy={20} r={4.5} />
        <Circle cx={12} cy={10} r={3} />
        <Circle cx={7} cy={3.5} r={2} />
      </G>
    </Svg>
  );
}

// 0 → 1 → 0 swim cycle, flipping to face the way it's heading
function useSwim(duration: number, delay = 0) {
  const x = useRef(new Animated.Value(0)).current;
  const facing = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const swim = (to: number) =>
      Animated.timing(x, { toValue: to, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const turn = (to: number) => Animated.timing(facing, { toValue: to, duration: 0, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([turn(1), swim(1), turn(-1), swim(0)]));
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, []);

  return { x, facing };
}

// Ripples, a turtle, fish and bubbles drifting in the water behind a
// screen's header. Put it as the first child of the sea-coloured container;
// the sand sheet below covers whatever reaches past the header.
export default function SeaLife() {
  const turtle = useSwim(9000);
  const fish = useSwim(5200, 1200);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const { top } = useSafeAreaInsets();
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    // Absolute children ignore the safe-area padding, so start below the notch
    <View style={[StyleSheet.absoluteFill, { top }]} pointerEvents="none">
      {RIPPLES.map(([left, top, width], i) => (
        <View key={i} style={{ position: 'absolute', left, top }}>
          <Ripple width={width} />
        </View>
      ))}

      <Animated.View
        style={[
          styles.turtle,
          {
            transform: [
              { translateX: turtle.x.interpolate({ inputRange: [0, 1], outputRange: [-50, 30] }) },
              { translateY: bobY },
              { scaleX: turtle.facing },
            ],
          },
        ]}
      >
        <Turtle />
      </Animated.View>

      <Animated.View
        style={[
          styles.fish,
          {
            transform: [
              { translateX: fish.x.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) },
              { scaleX: fish.facing },
            ],
          },
        ]}
      >
        <Fish />
      </Animated.View>

      <View style={styles.fishSmall}>
        <Fish color="#F2B544" />
      </View>

      <Animated.View style={[styles.bubblesLeft, { transform: [{ translateY: bobY }] }]}>
        <Bubbles />
      </Animated.View>
      <Animated.View style={[styles.bubblesRight, { transform: [{ translateY: bobY }] }]}>
        <Bubbles />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  turtle: { position: 'absolute', top: 70, right: '14%', opacity: 0.9 },
  fish: { position: 'absolute', top: 128, left: '22%', opacity: 0.85 },
  fishSmall: { position: 'absolute', top: 34, left: '44%', opacity: 0.7, transform: [{ scale: 0.7 }, { scaleX: -1 }] },
  bubblesLeft: { position: 'absolute', top: 76, left: '3%' },
  bubblesRight: { position: 'absolute', top: 128, right: '4%' },
});

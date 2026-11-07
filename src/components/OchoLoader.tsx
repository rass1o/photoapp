import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Themed';
import { OchoPlain } from './OchoArt';
import { useSettings } from '../context/SettingsContext';
import { colors, fonts } from '../theme';

// The app's loading state: Ocho bobbing in place while bubbles drift up past
// him, with a little line underneath. Use it wherever a whole section is
// waiting on data (buttons keep their small spinners).

const LINES = [
  'Ocho is fetching it…',
  'Swimming it over…',
  'Developing the film…',
  'Loading the next roll…',
  'Almost there…',
];

function Bubble({ delay, x, r }: { delay: number; x: number; r: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - p.value,
    transform: [{ translateY: -p.value * 46 }, { translateX: Math.sin(p.value * Math.PI * 2) * 3 }],
  }));
  return <Reanimated.View style={[styles.bubble, { left: x, width: r * 2, height: r * 2, borderRadius: r }, style]} />;
}

type Props = {
  size?: number;
  // A line of your own, or leave it out for a rotating fun one
  message?: string | null;
  compact?: boolean; // no text, just Ocho (inside small spaces)
};

export default function OchoLoader({ size = 64, message, compact = false }: Props) {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const moving = settings.animations && !reduceMotion;
  const bob = useSharedValue(0);
  const [line, setLine] = useState(() => Math.floor(Math.random() * LINES.length));

  useEffect(() => {
    if (!moving) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(bob);
  }, [moving, bob]);

  // A new fun line every couple of seconds while it's still loading
  useEffect(() => {
    if (message !== undefined || compact) return;
    const timer = setInterval(() => setLine((i) => (i + 1) % LINES.length), 2200);
    return () => clearInterval(timer);
  }, [message, compact]);

  const float = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * size * 0.1 }, { rotate: `${(bob.value - 0.5) * 6}deg` }],
  }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={{ width: size * 1.4, height: size * 1.25, alignItems: 'center', justifyContent: 'flex-end' }}>
        {moving && (
          <>
            <Bubble delay={0} x={size * 0.05} r={size * 0.05} />
            <Bubble delay={600} x={size * 1.2} r={size * 0.07} />
            <Bubble delay={1200} x={size * 1.05} r={size * 0.04} />
          </>
        )}
        <Reanimated.View style={float}>
          <OchoPlain size={size} />
        </Reanimated.View>
      </View>
      {!compact && message !== null && <Text style={styles.text}>{message ?? LINES[line]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  bubble: {
    position: 'absolute',
    bottom: '40%',
    borderWidth: 1.5,
    borderColor: colors.reef,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  text: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 6 },
});

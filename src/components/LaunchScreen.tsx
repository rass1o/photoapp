import { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Themed';
import Wordmark from './Wordmark';
import { fonts } from '../theme';

// Picks up exactly where the native splash leaves off (same color, same Ocho
// in the same spot), then brings him to life: he bobs, bubbles rise, the
// wordmark and tagline float in. Once the app is ready it fades away.

export const LAUNCH_BG = '#1D6FA3';
const OCHO = 220; // matches imageWidth in app.json's splash config
const MIN_SHOW_MS = 1400;

// Keep the native splash up until this screen has drawn
SplashScreen.preventAutoHideAsync().catch(() => {});

function Bubble({ x, size, delay }: { x: number; size: number; delay: number }) {
  const { height } = useWindowDimensions();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.1 ? p.value * 10 * 0.6 : (1 - p.value) * 0.6,
    transform: [{ translateY: -p.value * height * 0.55 }, { translateX: Math.sin(p.value * Math.PI * 3) * 6 }],
  }));
  return (
    <Reanimated.View
      style={[styles.bubble, { left: x, width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

type Props = {
  ready: boolean; // the app has what it needs underneath
  fontsReady: boolean;
  onDone: () => void;
};

export default function LaunchScreen({ ready, fontsReady, onDone }: Props) {
  const { width } = useWindowDimensions();
  const shownAt = useRef(Date.now());
  const bob = useSharedValue(0);
  const words = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [bob]);

  useEffect(() => {
    if (fontsReady) words.value = withDelay(150, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [fontsReady, words]);

  // Fade out once ready, but stay long enough to be seen
  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt.current));
    fade.value = withDelay(
      wait,
      withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
  }, [ready, fade, onDone]);

  const ocho = useAnimatedStyle(() => ({
    // slides up a little from the splash position to make room for the words
    transform: [{ translateY: -words.value * 46 - bob.value * 10 }, { rotate: `${(bob.value - 0.5) * 4}deg` }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 16 }],
  }));
  const container = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Reanimated.View
      style={[StyleSheet.absoluteFill, styles.screen, container]}
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="launchSea" cx="50%" cy="42%" r="70%">
            <Stop offset="0" stopColor="#3FA9D9" stopOpacity={0.55} />
            <Stop offset="1" stopColor={LAUNCH_BG} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#launchSea)" />
      </Svg>
      <Bubble x={width * 0.14} size={14} delay={0} />
      <Bubble x={width * 0.8} size={10} delay={700} />
      <Bubble x={width * 0.3} size={8} delay={1300} />
      <Bubble x={width * 0.66} size={16} delay={1900} />

      <Reanimated.View style={ocho}>
        <Image source={require('../../assets/splash-icon.png')} style={{ width: OCHO, height: OCHO }} />
      </Reanimated.View>
      {fontsReady && (
        <Reanimated.View style={[styles.words, wordStyle]}>
          <Wordmark size={30} />
          <Text style={styles.tagline}>Snap the theme. Make some waves.</Text>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: LAUNCH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  bubble: {
    position: 'absolute',
    bottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(191, 230, 247, 0.9)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  words: { position: 'absolute', top: '58%', alignItems: 'center' },
  tagline: { fontFamily: fonts.medium, fontSize: 15, color: '#E0F2FE', marginTop: 12 },
});

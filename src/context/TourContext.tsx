import { ComponentRef, createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Text } from '../components/Themed';
import { colors, bubbly } from '../theme';

// A short first-time walkthrough of the main tabs. Each step dims the screen
// except one part of it and explains it; tapping that part moves on (and, for
// a tab, opens it). Any step can be skipped, or the whole tour ended.
//
// Screens mark the parts it points at with useTourTarget('id'). Between
// steps the highlight glides to the next part instead of jumping, and the
// card fades. A part that isn't on screen right now (scrolled away, or not
// shown for this account) gets the card in the middle with a Next button.

type StepId =
  | 'home.feeds'
  | 'home.theme'
  | 'tab.Submit'
  | 'submit.streaks'
  | 'submit.weekly'
  | 'tab.Rankings'
  | 'tab.Profile'
  | 'profile.showcase'
  | 'tab.Shop';

type Step = { id: StepId; title: string; body: string; tab?: 'Home' | 'Submit' | 'Rankings' | 'Shop' | 'Profile' };

const STEPS: Step[] = [
  { id: 'home.feeds', title: 'Your feeds', body: 'Switch between photos from your friends, everyone on ShuttInk, and your groups.' },
  { id: 'home.theme', title: 'This week’s theme', body: 'Everyone shoots the same idea each week. Tap here any time to read what it’s about.' },
  { id: 'tab.Submit', title: 'Post a photo', body: 'Tap the camera to enter the weekly theme or post your daily photo.', tab: 'Submit' },
  { id: 'submit.streaks', title: 'Streaks', body: 'Post a daily photo every day and enter every weekly theme to keep your streaks going.' },
  {
    id: 'submit.weekly',
    title: 'The weekly theme',
    body: 'One photo per theme. Entering earns shutters, and on the last day everyone votes for the winners.',
  },
  { id: 'tab.Rankings', title: 'Rankings', body: 'See who’s leading this week and who won the past themes.', tab: 'Rankings' },
  { id: 'tab.Profile', title: 'Your profile', body: 'Your photos, streaks, badges and Ocho all live here.', tab: 'Profile' },
  { id: 'profile.showcase', title: 'Showcase', body: 'Show off your top 3 favorite photos you’ve taken. Tap a spot to add one.' },
  { id: 'tab.Shop', title: 'The shop', body: 'Spend your shutters on clams, frames, banners and outfits for Ocho.', tab: 'Shop' },
];

type TargetView = ComponentRef<typeof View>;
type Rect = { x: number; y: number; width: number; height: number };

type TourValue = {
  register: (id: StepId, view: TargetView | null) => void;
  start: () => void;
};

const TourContext = createContext<TourValue>({ register: () => {}, start: () => {} });

export const useTour = () => useContext(TourContext);

// Spread onto the View to highlight: <View {...useTourTarget('home.theme')}>
export function useTourTarget(id: StepId) {
  const { register } = useTour();
  const ref = useCallback((view: TargetView | null) => register(id, view), [id, register]);
  return { ref, collapsable: false };
}

const PAD = 6; // room around the highlighted part
const DIM = 'rgba(6, 20, 32, 0.72)';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function measure(view: TargetView): Promise<Rect> {
  return new Promise((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));
}

const same = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

type ProviderProps = {
  children: ReactNode;
  autoStart: boolean;
  onAutoStarted: () => void; // so it only starts on its own once
  // the app's navigation, since the tour sits outside the tab screens
  navigationRef: NavigationContainerRefWithCurrent<any>;
};

export function TourProvider({ children, autoStart, onAutoStarted, navigationRef }: ProviderProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const targets = useRef(new Map<StepId, TargetView>());
  const overlayRef = useRef<TargetView | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  // where the card goes for this step: null while finding the part, 'none'
  // when it isn't on screen
  const [placed, setPlaced] = useState<Rect | 'none' | null>(null);

  // The highlight's box, animated from one part to the next
  const hole = useRef({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    w: new Animated.Value(0),
    h: new Animated.Value(0),
  }).current;
  const shown = useRef(new Animated.Value(0)).current; // the whole overlay fading in and out
  const cardIn = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const hasHole = useRef(false);

  const register = useCallback((id: StepId, view: TargetView | null) => {
    if (view) targets.current.set(id, view);
    else targets.current.delete(id);
  }, []);

  const start = useCallback(() => {
    setPlaced(null);
    setIndex(0);
  }, []);

  // New accounts get it once, right after the intro
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => {
      onAutoStarted();
      start();
    }, 900);
    return () => clearTimeout(timer);
  }, [autoStart, start]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each step: fade the card, wait for the part to stop moving (a tab
  // opening, a header settling), then glide the highlight there and bring
  // the card back
  useEffect(() => {
    if (index === null) return;
    let cancelled = false;
    const step = STEPS[index];

    (async () => {
      Animated.timing(cardIn, { toValue: 0, duration: 120, useNativeDriver: true }).start();
      Animated.timing(shown, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      await wait(150);

      let found: Rect | null = null;
      let last: Rect | null = null;
      for (let tries = 0; tries < 12 && !cancelled; tries++) {
        const view = targets.current.get(step.id);
        if (view && overlayRef.current) {
          const [target, origin] = await Promise.all([measure(view), measure(overlayRef.current)]);
          // relative to the overlay, so it lines up whatever sits above it
          const rect = { x: target.x - origin.x, y: target.y - origin.y, width: target.width, height: target.height };
          if (last && same(rect, last)) {
            found = rect;
            break;
          }
          last = rect;
        }
        await wait(80);
      }
      if (cancelled) return;

      const onScreen = !!found && found.width > 0 && found.height > 0 && found.y >= 0 && found.y + found.height <= screenH;
      const to = onScreen
        ? { x: found!.x - PAD, y: found!.y - PAD, w: found!.width + PAD * 2, h: found!.height + PAD * 2 }
        : { x: screenW / 2, y: screenH / 2, w: 0, h: 0 }; // nothing to point at: dim it all

      // glide from the last part; jump straight there the first time
      const move = (value: Animated.Value, toValue: number) =>
        Animated.timing(value, {
          toValue,
          duration: hasHole.current ? 320 : 0,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
      hasHole.current = onScreen;

      Animated.parallel([
        move(hole.x, to.x),
        move(hole.y, to.y),
        move(hole.w, to.w),
        move(hole.h, to.h),
        Animated.timing(ring, { toValue: onScreen ? 1 : 0, duration: 200, useNativeDriver: false }),
      ]).start(() => {
        if (cancelled) return;
        setPlaced(onScreen ? { x: to.x, y: to.y, width: to.w, height: to.h } : 'none');
        Animated.timing(cardIn, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = () => {
    Animated.timing(shown, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIndex(null);
      setPlaced(null);
      hasHole.current = false;
      ring.setValue(0);
    });
  };

  const next = () => {
    if (index === null) return;
    if (index + 1 >= STEPS.length) end();
    else setIndex(index + 1);
  };

  // Moving on from a tab's step opens that tab (whether it was tapped or
  // skipped), so the next step has its screen to point at
  const advance = () => {
    const step = index === null ? null : STEPS[index];
    if (step?.tab && navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: step.tab });
    next();
  };

  const step = index === null ? null : STEPS[index];
  const box = placed && placed !== 'none' ? placed : null;
  // the card goes on whichever side of the highlight has more room
  const cardPosition = !box
    ? { top: screenH * 0.32 }
    : box.y + box.height / 2 < screenH / 2
      ? { top: box.y + box.height + 14 }
      : { bottom: screenH - box.y + 14 };

  return (
    <TourContext.Provider value={{ register, start }}>
      {children}
      <View ref={overlayRef} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {step && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown }]} pointerEvents="box-none">
            {/* four dim panels around the highlight; they catch stray taps */}
            <Animated.View style={[styles.dim, { left: 0, right: 0, top: 0, height: hole.y }]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.dim, { left: 0, right: 0, top: Animated.add(hole.y, hole.h), bottom: 0 }]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.dim, { left: 0, top: hole.y, height: hole.h, width: hole.x }]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.dim, { left: Animated.add(hole.x, hole.w), right: 0, top: hole.y, height: hole.h }]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Animated.View>

            <Animated.View
              style={[styles.hole, { left: hole.x, top: hole.y, width: hole.w, height: hole.h, opacity: ring }]}
              pointerEvents={box ? 'auto' : 'none'}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={advance}
                accessibilityRole="button"
                accessibilityLabel={`${step.title}. Tap to continue`}
              />
            </Animated.View>

            {placed && (
              <Animated.View style={[styles.card, cardPosition, { opacity: cardIn }]}>
                <Text style={styles.count}>
                  {index! + 1} of {STEPS.length}
                </Text>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.body}>{step.body}</Text>
                {box && <Text style={styles.hint}>Tap the highlighted spot to continue.</Text>}
                <View style={styles.buttons}>
                  <Pressable onPress={end} hitSlop={8}>
                    <Text style={styles.endText}>End tour</Text>
                  </Pressable>
                  <Pressable style={styles.nextButton} onPress={advance}>
                    <Text style={styles.nextText}>{index! + 1 === STEPS.length ? 'Done' : box ? 'Skip' : 'Next'}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>
    </TourContext.Provider>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  hole: { position: 'absolute', borderRadius: 14, borderWidth: 3, borderColor: colors.coral },
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.shell,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  count: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.5 },
  title: { ...bubbly, fontSize: 22, marginTop: 4 },
  body: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 6 },
  hint: { fontSize: 12, color: colors.reef, fontWeight: '600', marginTop: 10 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  endText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  nextButton: { backgroundColor: colors.deep, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 },
  nextText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});

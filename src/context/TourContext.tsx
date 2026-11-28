import { ComponentRef, createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Text } from '../components/Themed';
import { colors, bubbly } from '../theme';

// A short first-time walkthrough of the main tabs. Each step dims the screen
// except one part of it and explains it; tapping that part moves on (and, for
// a tab, opens it). Any step can be skipped, or the whole tour ended.
//
// Screens mark the parts it points at with useTourTarget('id'). A part that
// isn't on screen right now (scrolled away, or not shown for this account)
// gets the card in the middle with a Next button instead.

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
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const register = useCallback((id: StepId, view: TargetView | null) => {
    if (view) targets.current.set(id, view);
    else targets.current.delete(id);
  }, []);

  const start = useCallback(() => {
    setRect(null);
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

  // Find where this step's part is on screen (after its tab has opened)
  useEffect(() => {
    if (index === null) return;
    setRect(null);
    const step = STEPS[index];
    const timer = setTimeout(() => {
      const view = targets.current.get(step.id);
      if (!view) return;
      view.measureInWindow((x, y, width, height) => {
        const onScreen = width > 0 && height > 0 && y >= 0 && y + height <= screenH && x >= 0 && x + width <= screenW;
        if (onScreen) setRect({ x, y, width, height });
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [index, screenH, screenW]);

  const end = () => {
    setIndex(null);
    setRect(null);
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

  let card = null;
  if (step) {
    const hole = rect && {
      x: rect.x - PAD,
      y: rect.y - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    // the card goes on whichever side of the highlight has more room
    const below = !hole || hole.y + hole.height / 2 < screenH / 2;
    const cardPosition = !hole
      ? { top: screenH * 0.32 }
      : below
        ? { top: hole.y + hole.height + 14 }
        : { bottom: screenH - hole.y + 14 };

    card = (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {hole ? (
          <>
            {/* four dim panels around the highlight; they catch stray taps */}
            <Pressable style={[styles.dim, { left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }]} />
            <Pressable style={[styles.dim, { left: 0, top: hole.y + hole.height, right: 0, bottom: 0 }]} />
            <Pressable style={[styles.dim, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.height }]} />
            <Pressable
              style={[styles.dim, { left: hole.x + hole.width, top: hole.y, right: 0, height: hole.height }]}
            />
            <Pressable
              style={[styles.hole, { left: hole.x, top: hole.y, width: hole.width, height: hole.height }]}
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel={`${step.title}. Tap to continue`}
            />
          </>
        ) : (
          <Pressable style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View style={[styles.card, cardPosition]}>
          <Text style={styles.count}>
            {index! + 1} of {STEPS.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          {hole && <Text style={styles.hint}>Tap the highlighted spot to continue.</Text>}
          <View style={styles.buttons}>
            <Pressable onPress={end} hitSlop={8}>
              <Text style={styles.endText}>End tour</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={advance}>
              <Text style={styles.nextText}>{index! + 1 === STEPS.length ? 'Done' : hole ? 'Skip' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TourContext.Provider value={{ register, start }}>
      {children}
      {card}
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

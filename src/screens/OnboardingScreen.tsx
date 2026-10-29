import { useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Octopus from '../components/Octopus';
import { Text } from '../components/Themed';
import { useAuth } from '../context/AuthContext';
import { RARITY_COLORS } from '../lib/blindBox';
import { STREAK_BONUS, STREAK_BONUS_EVERY } from '../lib/streaks';
import { colors, bubbly } from '../theme';

type Props = {
  onDone: () => void;
};

// A small picture above the text, in place of the plain icon
type Visual = 'mascot' | 'streak' | 'prizes' | 'rarities' | 'peek';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  bullets?: string[];
  visual?: Visual;
};

const PRIZES = [200, 175, 150, 75, 50];

const SLIDES: Slide[] = [
  {
    icon: 'camera-outline',
    title: 'Welcome to ShuttInk',
    body:
      'A new photo theme drops every week. Shoot it your way, share it with everyone, and see how your take compares.',
  },
  {
    icon: 'compass-outline',
    title: 'Why ShuttInk?',
    body: 'ShuttInk is here to make you a braver, steadier photographer, one shot at a time.',
    bullets: [
      'Step out of your comfort zone: each theme nudges you toward subjects, light and techniques you might never try on your own. Only shoot landscapes? Try a portrait. Never shot at night? This might be the week',
      'Stay consistent: a daily photo and a streak turn shooting into a habit. You grow by showing up, not by waiting for the perfect moment',
      'Bring others in: whether you\u2019ve shot for years or just picked up your phone, everyone gets the same theme. It\u2019s an easy way to invite friends into photography',
      'Learn by looking: seeing dozens of takes on one theme shows you angles and ideas you\u2019d have missed',
    ],
  },
  {
    icon: 'calendar-outline',
    title: 'The weekly theme',
    body: 'Here\u2019s how a week goes:',
    bullets: [
      'A theme is announced at the start of the week',
      'Submit one photo for it, tagged as Digital or Film',
      'Everyone votes all week: double-tap a photo or hit the heart. Vote for as many as you like',
      'When the week ends, the top photos win shutters (more on that soon)',
    ],
  },
  {
    icon: 'happy-outline',
    visual: 'mascot',
    title: 'Meet Ocho',
    body: 'Ocho is ShuttInk\u2019s resident octopus, and he\u2019s camera-obsessed for a reason: his eyes basically are cameras.',
    bullets: [
      'Octopus eyes are built like a camera, with an iris, a lens and a retina, much like an aperture, lens and sensor',
      'To focus, he slides his lens closer or farther away, the same way a camera lens does',
      'You get your own Ocho: name him and dress him up in the Shop',
    ],
  },
  {
    icon: 'flash-outline',
    visual: 'prizes',
    title: 'Shutters & prizes',
    body: 'Shutters are ShuttInk\u2019s currency. You earn them by shooting:',
    bullets: [
      'Each week\u2019s top 5 win 200, 175, 150, 75 and 50 shutters. Ties share the spot',
      'Every daily photo earns 1 shutter',
      `Plus +${STREAK_BONUS} every ${STREAK_BONUS_EVERY} days you keep your day streak going`,
      'Feeling lucky? A clam blind box in the Shop holds 2 surprises for Ocho, with a shot at a legendary sidekick. Duplicates sell back for half',
    ],
  },
  {
    icon: 'flame-outline',
    visual: 'streak',
    title: 'Keep your streaks',
    body: 'Two streaks show on your profile for everyone to see:',
    bullets: [
      'Day streak: post a daily photo (any subject, no theme) every day in a row. Miss a day and it starts over',
      `Every ${STREAK_BONUS_EVERY} days in a row pays a +${STREAK_BONUS} shutter bonus, on top of the usual 1 per daily photo`,
      'Week streak: enter the weekly theme week after week',
      'The calendar on the Submit tab shows every day you posted',
    ],
  },
  {
    icon: 'storefront-outline',
    visual: 'rarities',
    title: 'Spend them in the Shop',
    body: 'Shutters buy things that show off your style:',
    bullets: [
      'Avatar frames, banners and badges for your profile',
      'Colors, hats, glasses, props and new lines for Ocho. Prices go up with rarity',
      'Film stamps to tag the stock you shot on',
      'Theme tickets to pitch next week\u2019s theme',
    ],
  },
  {
    icon: 'images-outline',
    visual: 'peek',
    title: 'Ready to sea others\u2019 photos?',
    body: 'This week\u2019s theme, today\u2019s daily shots and a whole feed of other photographers\u2019 takes are waiting. Ocho\u2019s already got his camera out.',
  },
];

function SlideVisual({ visual, icon }: { visual?: Visual; icon: Slide['icon'] }) {
  switch (visual) {
    case 'mascot':
      return <Octopus color="#a78bfa" accessory="beret" heldItem="camera" size={120} />;
    case 'peek':
      return <Octopus color="#a78bfa" accessory="beret" pose="peek" size={150} />;
    case 'streak':
      return (
        <View style={styles.streakCard}>
          <Ionicons name="flame" size={30} color={colors.coral} />
          <View style={styles.streakBars}>
            {Array.from({ length: STREAK_BONUS_EVERY }, (_, i) => (
              <View key={i} style={[styles.streakBar, i < STREAK_BONUS_EVERY - 1 && styles.streakBarOn]} />
            ))}
          </View>
          <Text style={styles.streakBonus}>+{STREAK_BONUS}</Text>
        </View>
      );
    case 'prizes':
      return (
        <View style={styles.chipRow}>
          {PRIZES.map((p, i) => (
            <View key={p} style={[styles.prize, i === 0 && styles.prizeFirst]}>
              <Text style={styles.prizePlace}>#{i + 1}</Text>
              <View style={styles.prizeAmount}>
                <Ionicons name="flash" size={11} color={i === 0 ? colors.white : colors.deep} />
                <Text style={[styles.prizeText, i === 0 && styles.prizeTextFirst]}>{p}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    case 'rarities':
      return (
        <View style={styles.chipRow}>
          {(
            [
              ['common', 20],
              ['uncommon', 40],
              ['rare', 60],
              ['epic', 100],
              ['legendary', 150],
            ] as const
          ).map(([rarity, price]) => (
            <View key={rarity} style={[styles.rarity, { backgroundColor: RARITY_COLORS[rarity].bg }]}>
              <Text style={[styles.rarityName, { color: RARITY_COLORS[rarity].fg }]}>
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              </Text>
              <Text style={[styles.rarityPrice, { color: RARITY_COLORS[rarity].fg }]}>{price}</Text>
            </View>
          ))}
        </View>
      );
    default:
      return (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={36} color={colors.deep} />
        </View>
      );
  }
}

export default function OnboardingScreen({ onDone }: Props) {
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const slideX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const turning = useRef(false);

  // The page slides out toward where you're heading, the next one slides in
  // from the other side and its picture pops in
  const goTo = (next: number) => {
    if (turning.current || next < 0 || next >= SLIDES.length) return;
    turning.current = true;
    const dir = next > index ? 1 : -1;
    Animated.parallel([
      Animated.timing(slideX, { toValue: -dir * 50, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setIndex(next);
      slideX.setValue(dir * 70);
      pop.setValue(0.5);
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
      ]).start(() => {
        turning.current = false;
      });
    });
  };

  const title = index === 0 && user?.username ? `Welcome, ${user.username}!` : slide.title;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        {!isLast && (
          <Pressable onPress={onDone} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Animated.View style={[styles.page, { opacity: fade, transform: [{ translateX: slideX }] }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.visual, { transform: [{ scale: pop }] }]}>
            <SlideVisual visual={slide.visual} icon={slide.icon} />
          </Animated.View>

          <Text style={styles.title}>{title}</Text>
          {index === 0 && user?.username ? <Text style={styles.kicker}>Welcome to ShuttInk</Text> : null}
          <Text style={styles.body}>{slide.body}</Text>

          {slide.bullets && (
            <View style={styles.bulletList}>
              {slide.bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]} />
          ))}
        </View>

        <View style={styles.buttons}>
          {index > 0 && (
            <Pressable style={styles.backButton} onPress={() => goTo(index - 1)}>
              <Ionicons name="chevron-back" size={20} color={colors.deep} />
            </Pressable>
          )}
          <Pressable style={styles.continueButton} onPress={() => (isLast ? onDone() : goTo(index + 1))}>
            <Text style={styles.continueText}>{isLast ? 'Let’s Ride' : 'Continue'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, minHeight: 32 },
  skipText: { fontSize: 13, color: colors.muted },

  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 12 },
  visual: { alignSelf: 'center', alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.shell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...bubbly, fontSize: 30, textAlign: 'center', marginBottom: 12 },
  kicker: { fontSize: 13, color: colors.reef, fontWeight: '600', textAlign: 'center', marginTop: -6, marginBottom: 10 },
  body: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 },

  bulletList: { marginTop: 20, gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.deep,
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.shell,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  streakBars: { flexDirection: 'row', gap: 5 },
  streakBar: { width: 18, height: 10, borderRadius: 5, backgroundColor: colors.coralLight },
  streakBarOn: { backgroundColor: colors.coral },
  streakBonus: { ...bubbly, fontSize: 20, color: colors.coral },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  prize: {
    alignItems: 'center',
    backgroundColor: colors.shell,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    minWidth: 50,
  },
  prizeFirst: { backgroundColor: colors.deep },
  prizePlace: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  prizeAmount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prizeText: { fontSize: 15, fontWeight: '700', color: colors.deep },
  prizeTextFirst: { color: colors.white },
  rarity: { alignItems: 'center', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  rarityName: { fontSize: 11, fontWeight: '700' },
  rarityPrice: { fontSize: 12, fontWeight: '600' },

  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sandDark },
  dotDone: { backgroundColor: colors.reef },
  dotActive: { backgroundColor: colors.deep, width: 18 },

  buttons: { flexDirection: 'row', gap: 10 },
  backButton: {
    width: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    flex: 1,
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});

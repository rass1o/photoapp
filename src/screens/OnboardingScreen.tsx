import { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Octopus from '../components/Octopus';
import { Text } from '../components/Themed';
import { colors, bubbly } from '../theme';

type Props = {
  onDone: () => void;
};

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  bullets?: string[];
  mascot?: boolean; // show Ocho instead of the icon
};

const SLIDES: Slide[] = [
  {
    icon: 'camera-outline',
    title: 'Welcome to ShuttInk',
    body:
      'A new photo theme drops every week. Shoot it your way, share it with everyone, and see how your take compares.',
  },
  {
    icon: 'flame-outline',
    title: 'How it works',
    body: 'Here\u2019s the weekly rhythm:',
    bullets: [
      'A theme is announced at the start of the week',
      'Submit one photo for it, tagged as Digital or Film',
      'Post a daily photo too: one shot a day, any subject, no theme. It keeps your streak alive, and every 5 days in a row pays a +20 shutter bonus',
      'Everyone votes on their favorites all week',
    ],
  },
  {
    icon: 'heart-outline',
    title: 'Voting & shutters',
    body: 'Shutters are ShuttInk\u2019s currency. Here\u2019s how they work:',
    bullets: [
      'Double-tap or hit the heart to vote. Vote for as many photos as you like',
      'Each week\u2019s top 5, film or digital, win 200, 175, 150, 75 and 50 shutters. Ties share the spot',
      'Every daily photo earns you 1 shutter',
    ],
  },
  {
    icon: 'happy-outline',
    mascot: true,
    title: 'Meet Ocho',
    body: 'Ocho is ShuttInk\u2019s resident octopus, and he\u2019s camera-obsessed for a reason: his eyes basically are cameras.',
    bullets: [
      'Octopus eyes are built like a camera, with an iris, a lens and a retina, much like an aperture, lens and sensor',
      'To focus, he slides his lens closer or farther away, the same way a camera lens does',
      'So every camera he sees feels like family. Eight arms helps, too: he never misses a shot',
    ],
  },
  {
    icon: 'storefront-outline',
    title: 'The Shop',
    body: 'Shell out your shutters in the Shop:',
    bullets: [
      'Avatar frames, banners and badges for your profile',
      'Make Ocho your own: name him, then dress him up with colors, hats, glasses, props and new things to say',
      'Film stamps to tag the stock you shot on',
      'Theme tickets to pitch next week\u2019s theme',
    ],
  },
];

export default function OnboardingScreen({ onDone }: Props) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const handleContinue = () => {
    if (isLast) {
      onDone();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        {!isLast && (
          <Pressable onPress={onDone}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {slide.mascot ? (
          <View style={styles.mascot}>
            <Octopus color="#a78bfa" accessory="beret" heldItem="camera" size={130} />
          </View>
        ) : (
          <View style={styles.iconCircle}>
            <Ionicons name={slide.icon} size={36} color={colors.deep} />
          </View>
        )}

        <Text style={styles.title}>{slide.title}</Text>
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

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>{isLast ? 'Let\u2019s dive in' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, minHeight: 32 },
  skipText: { fontSize: 13, color: colors.muted },

  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 12 },
  mascot: { alignSelf: 'center', marginBottom: 8 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.shell,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  title: { ...bubbly, fontSize: 30, textAlign: 'center', marginBottom: 12 },
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

  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sandDark },
  dotActive: { backgroundColor: colors.deep, width: 18 },

  continueButton: {
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
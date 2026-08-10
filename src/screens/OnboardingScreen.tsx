import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onDone: () => void;
};

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  bullets?: string[];
};

const SLIDES: Slide[] = [
  {
    icon: 'camera-outline',
    title: 'Welcome to Frames',
    body:
      'A new photo theme drops every week. Shoot it your way, share it with everyone, and see how your take compares.',
  },
  {
    icon: 'flame-outline',
    title: 'How it works',
    body: 'Here\u2019s the weekly rhythm:',
    bullets: [
      'A theme is announced at the start of the week',
      'Submit one photo, tagged as Digital or Film',
      'Everyone votes on their favorites all week',
      'Top photos win currency and climb the rankings',
    ],
  },
  {
    icon: 'heart-outline',
    title: 'Voting & currency',
    body: 'Two things power the whole app:',
    bullets: [
      'Double-tap or hit the heart to vote — you can vote for as many photos as you like',
      'Win votes to earn "shutters," the in-app currency',
      'Spend shutters on profile customization: avatar frames, banners, and badges',
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

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={slide.icon} size={36} color="#0B1418" />
        </View>

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
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>{isLast ? 'Get started' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#D9E2E6' },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, minHeight: 32 },
  skipText: { fontSize: 13, color: '#46606B' },

  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1418', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 14, color: '#46606B', textAlign: 'center', lineHeight: 21 },

  bulletList: { marginTop: 20, gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0B1418',
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, color: '#1A2A32', lineHeight: 20 },

  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b8c4c9' },
  dotActive: { backgroundColor: '#0B1418', width: 18 },

  continueButton: {
    backgroundColor: '#0B1418',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
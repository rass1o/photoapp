import { View, StyleSheet, Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Octopus from './Octopus';
import { Text } from './Themed';
import { STREAK_BONUS, STREAK_BONUS_EVERY } from '../lib/streaks';
import { colors, bubbly } from '../theme';

export type LostStreaks = { daily: number; weekly: number }; // lengths that ended (0 = that one's fine)

const OCHO_SIZE = 110;

// Shown once when a streak breaks: a teary Ocho and a nudge to start again
export default function StreakLostModal({ lost, onClose }: { lost: LostStreaks | null; onClose: () => void }) {
  const k = OCHO_SIZE / 200; // Octopus drawing units -> points
  const both = !!lost && lost.daily > 0 && lost.weekly > 0;

  return (
    <Modal visible={!!lost} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View>
            <Octopus color="#a78bfa" size={OCHO_SIZE} animated={false} />
            {/* a tear rolling down from his right eye */}
            <Svg
              style={[styles.tear, { left: 128 * k, top: (100 + 30) * k }]}
              width={14 * k * 1.6}
              height={22 * k * 1.6}
              viewBox="0 0 14 22"
            >
              <Path d="M7,0 C9,6 14,11 14,15 C14,19 11,22 7,22 C3,22 0,19 0,15 C0,11 5,6 7,0 Z" fill="#7DD3FC" stroke="#14507A" strokeWidth={1.5} />
            </Svg>
          </View>

          <Text style={styles.title}>{both ? 'Your streaks ended' : 'Your streak ended'}</Text>
          {lost && lost.daily > 0 && (
            <Text style={styles.line}>
              Your <Text style={styles.strong}>{lost.daily}-day</Text> daily photo streak ended, since a whole day went
              by without one.
            </Text>
          )}
          {lost && lost.weekly > 0 && (
            <Text style={styles.line}>
              Your <Text style={styles.strong}>{lost.weekly}-week</Text> theme streak ended, since you skipped last
              week{'’'}s theme.
            </Text>
          )}
          <Text style={styles.encourage}>
            Ocho{'’'}s a little teary, but every streak starts at day one. Post today to start a new one: every{' '}
            {STREAK_BONUS_EVERY} days in a row earns +{STREAK_BONUS} shutters.
          </Text>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Start a new streak</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: colors.shell, borderRadius: 18, padding: 20 },
  tear: { position: 'absolute' },
  title: { ...bubbly, fontSize: 24, textAlign: 'center', marginTop: 4, marginBottom: 10 },
  line: { fontSize: 14, color: colors.ink, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  strong: { fontWeight: '700', color: colors.coral },
  encourage: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 4 },
  button: { alignSelf: 'stretch', backgroundColor: colors.deep, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});

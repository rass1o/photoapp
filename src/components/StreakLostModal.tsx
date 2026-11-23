import { View, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Octopus from './Octopus';
import { Text } from './Themed';
import { STREAK_BONUS, STREAK_BONUS_EVERY } from '../lib/streaks';
import { colors, bubbly } from '../theme';

export type LostStreaks = { daily: number; weekly: number }; // lengths that ended (0 = that one's fine)

const OCHO_SIZE = 100;

interface StreakLostModalProps {
  lost: LostStreaks | null;
  onClose: () => void;
  onRestore?: (streakType: 'daily' | 'weekly') => void;
  restoreProgress?: { daily: number; weekly: number };
  isRestoring?: boolean;
}

// Progress dots component showing 3 circles (filled if completed)
function ProgressDots({ completed, total = 3 }: { completed: number; total?: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, index) => {
        const isFilled = index < completed;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              isFilled ? styles.dotFilled : styles.dotEmpty,
            ]}
          >
            {isFilled && <View style={styles.dotInner} />}
          </View>
        );
      })}
    </View>
  );
}

// Shown when a streak breaks: Ocho with a tear and the option to watch ads to restore, or start fresh
export default function StreakLostModal({
  lost,
  onClose,
  onRestore,
  restoreProgress = { daily: 0, weekly: 0 },
  isRestoring = false,
}: StreakLostModalProps) {
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
              <Path
                d="M7,0 C9,6 14,11 14,15 C14,19 11,22 7,22 C3,22 0,19 0,15 C0,11 5,6 7,0 Z"
                fill="#7DD3FC"
                stroke="#14507A"
                strokeWidth={1.5}
              />
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

          {/* Ad-based Streak Restore Section */}
          {onRestore && (
            <View style={styles.restoreContainer}>
              {lost && lost.daily > 0 && (
                <View style={styles.restoreCard}>
                  <View style={styles.restoreHeader}>
                    <Text style={styles.restoreTitle}>Restore daily streak ({lost.daily} days)</Text>
                    <ProgressDots completed={restoreProgress.daily} total={3} />
                  </View>
                  <Pressable
                    style={[styles.adButton, isRestoring && styles.buttonDisabled]}
                    onPress={() => onRestore('daily')}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.adButtonText}>
                        🎬 Watch ad to restore ({restoreProgress.daily}/3)
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              {lost && lost.weekly > 0 && (
                <View style={styles.restoreCard}>
                  <View style={styles.restoreHeader}>
                    <Text style={styles.restoreTitle}>Restore weekly streak ({lost.weekly} weeks)</Text>
                    <ProgressDots completed={restoreProgress.weekly} total={3} />
                  </View>
                  <Pressable
                    style={[styles.adButton, isRestoring && styles.buttonDisabled]}
                    onPress={() => onRestore('weekly')}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.adButtonText}>
                        🎬 Watch ad to restore ({restoreProgress.weekly}/3)
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              <Text style={styles.windowNotice}>
                Restore is available for 24h after streak loss (1 restore per 7 days).
              </Text>
            </View>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.encourage}>
            Ocho{'’'}s a little teary, but every streak starts at day one. Post today: every {STREAK_BONUS_EVERY} days
            in a row earns +{STREAK_BONUS} shutters.
          </Text>

          <Pressable style={styles.button} onPress={onClose} disabled={isRestoring}>
            <Text style={styles.buttonText}>Start a new streak</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.shell,
    borderRadius: 20,
    padding: 20,
  },
  tear: { position: 'absolute' },
  title: { ...bubbly, fontSize: 22, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  line: { fontSize: 13, color: colors.ink, textAlign: 'center', lineHeight: 18, marginBottom: 4 },
  strong: { fontWeight: '700', color: colors.coral },
  restoreContainer: {
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 4,
  },
  restoreCard: {
    backgroundColor: colors.sandLight,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  restoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  restoreTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.deep,
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotEmpty: {
    borderColor: colors.sandDark,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: colors.coral,
    backgroundColor: colors.coral,
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  adButton: {
    backgroundColor: colors.coral,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  adButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  windowNotice: {
    fontSize: 11,
    color: colors.faint,
    textAlign: 'center',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.sandBorder,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: colors.muted,
  },
  encourage: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17, marginBottom: 12 },
  button: {
    alignSelf: 'stretch',
    backgroundColor: colors.deep,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});

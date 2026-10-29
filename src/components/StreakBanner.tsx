import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { STREAK_BONUS, STREAK_BONUS_EVERY, daysToBonus } from '../lib/streaks';
import { colors, fonts } from '../theme';

type Props = {
  daily: number;
  weekly: number;
  // Your own profile and the Submit tab say how far off the next bonus is
  showBonusHint?: boolean;
};

const DAILY = { bg: '#FFE9DF', border: colors.coral, text: '#B5391E', icon: colors.coral };
const WEEKLY = { bg: '#FEF3C7', border: '#D97706', text: '#92400E', icon: '#D97706' };

function Flame({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={active ? 'flame' : 'flame-outline'} size={26} color={active ? color : colors.faint} />
    </Animated.View>
  );
}

// Big daily + weekly streak tiles, shown on profiles and the Submit tab so
// a streak is the first thing you (and anyone visiting) notice
export default function StreakBanner({ daily, weekly, showBonusHint }: Props) {
  const toBonus = daysToBonus(daily);
  const filled = daily % STREAK_BONUS_EVERY;

  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: DAILY.bg, borderColor: DAILY.border }, !daily && styles.tileIdle]}>
        <View style={styles.top}>
          <Flame active={daily > 0} color={DAILY.icon} />
          <Text style={[styles.count, { color: daily ? DAILY.text : colors.faint }]}>{daily}</Text>
        </View>
        <Text style={[styles.label, { color: daily ? DAILY.text : colors.muted }]}>
          day streak
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: STREAK_BONUS_EVERY }, (_, i) => (
            <View key={i} style={[styles.dot, i < filled && { backgroundColor: DAILY.border }]} />
          ))}
        </View>
        {showBonusHint && (
          <Text style={styles.hint}>
            {toBonus === STREAK_BONUS_EVERY && daily > 0
              ? `Bonus earned! Next +${STREAK_BONUS} in ${STREAK_BONUS_EVERY}`
              : `+${STREAK_BONUS} in ${toBonus} ${toBonus === 1 ? 'day' : 'days'}`}
          </Text>
        )}
      </View>

      <View style={[styles.tile, { backgroundColor: WEEKLY.bg, borderColor: WEEKLY.border }, !weekly && styles.tileIdle]}>
        <View style={styles.top}>
          <Ionicons name={weekly ? 'trophy' : 'trophy-outline'} size={24} color={weekly ? WEEKLY.icon : colors.faint} />
          <Text style={[styles.count, { color: weekly ? WEEKLY.text : colors.faint }]}>{weekly}</Text>
        </View>
        <Text style={[styles.label, { color: weekly ? WEEKLY.text : colors.muted }]}>
          week streak
        </Text>
        <Text style={styles.hint}>{weekly ? 'Themes in a row' : 'Submit to a theme to start'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tileIdle: { backgroundColor: colors.sandLight, borderColor: colors.sandBorder },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 6 },
  dot: { width: 14, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)' },
  hint: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'center' },
});

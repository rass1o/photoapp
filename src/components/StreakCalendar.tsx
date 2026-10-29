import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { localDateString } from '../lib/date';
import { Text } from './Themed';
import { colors } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Consecutive posted days ending today, or yesterday if today isn't posted
// yet (the streak is still alive until midnight)
export function currentStreak(posted: Set<string>, today = new Date()) {
  let day = posted.has(localDateString(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (posted.has(localDateString(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

// Month grid of the days you posted a daily photo, so your streak has receipts.
// `refreshKey` reloads it after a new post.
export default function StreakCalendar({ userId, refreshKey }: { userId: string; refreshKey?: number }) {
  const [posted, setPosted] = useState<Set<string> | null>(null);
  const [firstDate, setFirstDate] = useState<string | null>(null);
  const today = new Date();
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useEffect(() => {
    supabase
      .from('daily_submissions')
      .select('submission_date')
      .eq('user_id', userId)
      .order('submission_date', { ascending: true })
      .then(({ data }) => {
        const dates = (data ?? []).map((d) => String(d.submission_date).slice(0, 10));
        setPosted(new Set(dates));
        setFirstDate(dates[0] ?? null);
      });
  }, [userId, refreshKey]);

  const todayStr = localDateString(today);

  const cells = useMemo(() => {
    const first = new Date(month.year, month.month, 1);
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
    const blanks: Array<null> = Array(first.getDay()).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => localDateString(new Date(month.year, month.month, i + 1)));
    return [...blanks, ...days];
  }, [month]);

  if (!posted) return <ActivityIndicator color={colors.deep} style={{ marginVertical: 16 }} />;

  const streak = currentStreak(posted, today);
  const monthPrefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
  const postedThisMonth = [...posted].filter((d) => d.startsWith(monthPrefix)).length;

  const isCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth();
  const canGoBack = !!firstDate && firstDate.slice(0, 7) < monthPrefix;
  const shiftMonth = (by: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={14} color={colors.coral} />
          <Text style={styles.streakText}>
            {streak} day streak
          </Text>
        </View>
        <Text style={styles.monthCount}>
          {postedThisMonth} {postedThisMonth === 1 ? 'photo' : 'photos'} this month
        </Text>
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} disabled={!canGoBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={18} color={canGoBack ? colors.deep : colors.sandDark} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} disabled={isCurrentMonth} hitSlop={10}>
          <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? colors.sandDark : colors.deep} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((d, i) => (
          <Text key={`w${i}`} style={styles.weekday}>
            {d}
          </Text>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`b${i}`} style={styles.cell} />;
          const done = posted.has(date);
          const isToday = date === todayStr;
          const future = date > todayStr;
          // Join neighbouring posted days into a streak "chain"
          const linkLeft = done && i % 7 !== 0 && posted.has(cells[i - 1] ?? '');
          const linkRight = done && i % 7 !== 6 && posted.has(cells[i + 1] ?? '');
          return (
            <View key={date} style={styles.cell}>
              {linkLeft && <View style={[styles.link, styles.linkLeft]} />}
              {linkRight && <View style={[styles.link, styles.linkRight]} />}
              <View style={[styles.day, done && styles.dayDone, isToday && !done && styles.dayToday]}>
                {done ? (
                  <Ionicons name="camera" size={13} color={colors.white} />
                ) : (
                  <Text style={[styles.dayText, future && styles.dayFuture, isToday && styles.dayTodayText]}>
                    {Number(date.slice(8))}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const DAY = 30;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.sandLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    padding: 12,
    marginBottom: 14,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.coralLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontSize: 13, fontWeight: '700', color: colors.coral },
  monthCount: { fontSize: 12, color: colors.muted },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.faint, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, height: DAY + 6, alignItems: 'center', justifyContent: 'center' },
  link: { position: 'absolute', height: 8, backgroundColor: colors.seaDeep, top: (DAY + 6 - 8) / 2 },
  linkLeft: { left: 0, right: '50%' },
  linkRight: { left: '50%', right: 0 },
  day: { width: DAY, height: DAY, borderRadius: DAY / 2, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: colors.reef },
  dayToday: { borderWidth: 2, borderColor: colors.reef },
  dayText: { fontSize: 12, color: colors.text },
  dayTodayText: { fontWeight: '700', color: colors.reef },
  dayFuture: { color: colors.sandDark },
});

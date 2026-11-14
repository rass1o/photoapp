import { ComponentRef, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

// A date and time chooser made of chips: a row of days, then a row of times
// in half hours. Plain JS, so it works without a new native build.

type Props = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  open: boolean;
  onToggle: () => void;
};

const DAYS_AHEAD = 90;
const DAY_CHIP = 58;
const TIME_CHIP = 76;
const GAP = 6;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatDateTime(d: Date) {
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function DateTimeField({ label, value, onChange, open, onToggle }: Props) {
  const dayRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const timeRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // From today (or the chosen day, if it's already past) for three months
  const days = useMemo(() => {
    const first = startOfDay(new Date(Math.min(Date.now(), value.getTime())));
    const count = Math.max(DAYS_AHEAD, Math.ceil((value.getTime() - first.getTime()) / 86400000) + 14);
    return Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const times = useMemo(() => Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 })), []);

  const dayIndex = days.findIndex((d) => d.getTime() === startOfDay(value).getTime());
  const timeIndex = value.getHours() * 2 + (value.getMinutes() >= 30 ? 1 : 0);

  // Open with the chosen day and time in view
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      dayRef.current?.scrollTo({ x: Math.max(0, dayIndex * (DAY_CHIP + GAP) - 60), animated: false });
      timeRef.current?.scrollTo({ x: Math.max(0, timeIndex * (TIME_CHIP + GAP) - 60), animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDay = (day: Date) =>
    onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate(), value.getHours(), value.getMinutes()));
  const pickTime = (h: number, m: number) => onChange(new Date(value.getFullYear(), value.getMonth(), value.getDate(), h, m));

  return (
    <View style={styles.field}>
      <Pressable style={[styles.row, open && styles.rowOpen]} onPress={onToggle}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatDateTime(value)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </Pressable>

      {open && (
        <View style={styles.pickers}>
          <ScrollView ref={dayRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map((d, i) => {
              const active = i === dayIndex;
              return (
                <Pressable key={d.getTime()} style={[styles.dayChip, active && styles.chipActive]} onPress={() => pickDay(d)}>
                  <Text style={[styles.dayName, active && styles.chipTextActive]}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNumber, active && styles.chipTextActive]}>{d.getDate()}</Text>
                  <Text style={[styles.dayName, active && styles.chipTextActive]}>
                    {d.toLocaleDateString(undefined, { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView ref={timeRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {times.map(({ h, m }, i) => {
              const active = i === timeIndex;
              return (
                <Pressable key={i} style={[styles.timeChip, active && styles.chipActive]} onPress={() => pickTime(h, m)}>
                  <Text style={[styles.timeText, active && styles.chipTextActive]}>
                    {new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.sand, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  rowOpen: { borderBottomWidth: 1, borderBottomColor: colors.sandBorder },
  label: { fontSize: 13, color: colors.muted, width: 92 },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  pickers: { paddingVertical: 10, gap: 8 },
  chips: { paddingHorizontal: 10, gap: GAP },
  dayChip: {
    width: DAY_CHIP,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.shell,
  },
  timeChip: {
    width: TIME_CHIP,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.shell,
  },
  chipActive: { backgroundColor: colors.deep },
  dayName: { fontSize: 11, color: colors.muted },
  dayNumber: { fontSize: 18, fontWeight: '700', color: colors.ink },
  timeText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  chipTextActive: { color: colors.white },
});

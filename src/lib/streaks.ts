import { localDateString } from './date';

// Every STREAK_BONUS_EVERY days in a row, the daily photo pays STREAK_BONUS
// extra shutters (see record_daily_post)
export const STREAK_BONUS_EVERY = 5;
export const STREAK_BONUS = 20;

// The stored daily streak only resets on your next post, so treat it as
// broken once a whole day has gone by without one
export function liveDailyStreak(count: number | null | undefined, lastDate: string | null | undefined) {
  if (!count || !lastDate) return 0;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last = lastDate.slice(0, 10);
  return last === localDateString(today) || last === localDateString(yesterday) ? count : 0;
}

// Days until the next bonus (5 → 0 means today's post was a bonus day)
export function daysToBonus(streak: number) {
  return STREAK_BONUS_EVERY - (streak % STREAK_BONUS_EVERY);
}

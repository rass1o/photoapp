import { supabase } from './supabase';

// Starts the next weekly theme if the last one has ended (the server picks
// it from the rotation). Call before loading the current theme. Failing is
// harmless: the screen just shows whatever theme exists.
export async function ensureCurrentTheme() {
  const { error } = await supabase.rpc('ensure_current_theme');
  if (error) console.log('Theme rollover check failed:', error.message);
}

// Each theme's last day is for voting only: submissions close when it
// starts (matches theme_voting_opens on the server)
export const VOTING_DAY_MS = 24 * 60 * 60 * 1000;

export type ThemePhase = 'submit' | 'vote' | 'ended';

export function themePhase(endDate: string | null | undefined, now = Date.now()): ThemePhase {
  if (!endDate) return 'ended';
  const end = new Date(endDate).getTime();
  if (now >= end) return 'ended';
  return now >= end - VOTING_DAY_MS ? 'vote' : 'submit';
}

export function votingOpensAt(endDate: string) {
  return new Date(new Date(endDate).getTime() - VOTING_DAY_MS);
}

// "2d 5h" / "5h 12m" / "12m"
export function formatTimeLeft(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// What the theme banner says about where the week is at
export function themeStatus(endDate: string) {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  switch (themePhase(endDate, now)) {
    case 'submit':
      return `Submissions close in ${formatTimeLeft(end - VOTING_DAY_MS - now)}`;
    case 'vote':
      return `Voting day! Ends in ${formatTimeLeft(end - now)}`;
    default:
      return 'Voting closed';
  }
}

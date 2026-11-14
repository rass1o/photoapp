import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import ReportSheet, { ReportTarget } from '../components/ReportSheet';

// Reporting and blocking, shared by every screen.
//  - Photos and comments you report are covered for you right away, and for
//    everyone once 3 people have reported them (until they're reviewed).
//  - Accounts you block disappear from your feeds, comments and
//    notifications, and their profile is covered by Ocho with a shield.

export type CoverKind = 'reported' | 'hidden' | 'mine' | 'blocked';

type ModerationValue = {
  blocked: Set<string>;
  isBlocked: (userId: string | null | undefined) => boolean;
  // Why a photo or comment should be covered, or null to show it
  coverFor: (targetId: string, ownerId: string | null | undefined) => CoverKind | null;
  openReport: (target: ReportTarget) => void;
  // Asks first, then blocks
  confirmBlock: (userId: string, username: string, onDone?: () => void) => void;
  confirmUnblock: (userId: string, username: string, onDone?: () => void) => void;
  // A ... menu for someone else's photo or comment: report it or block them
  openContentMenu: (target: ReportTarget, beforeReport?: () => void) => void;
  refresh: () => Promise<void>;
};

const empty = new Set<string>();
const ModerationContext = createContext<ModerationValue>({
  blocked: empty,
  isBlocked: () => false,
  coverFor: () => null,
  openReport: () => {},
  confirmBlock: () => {},
  confirmUnblock: () => {},
  openContentMenu: () => {},
  refresh: async () => {},
});

const NOUN: Record<ReportTarget['kind'], string> = {
  photo: 'photo',
  daily: 'photo',
  group_photo: 'photo',
  comment: 'comment',
  account: 'account',
};

export function ModerationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Set<string>>(empty);
  const [reported, setReported] = useState<Set<string>>(empty);
  const [hidden, setHidden] = useState<Set<string>>(empty);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setBlocked(empty);
      setReported(empty);
      setHidden(empty);
      return;
    }
    const [b, r, h] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('reports').select('target_id').eq('reporter_id', user.id),
      supabase.from('hidden_content').select('target_id'),
    ]);
    setBlocked(new Set((b.data ?? []).map((row) => row.blocked_id as string)));
    setReported(new Set((r.data ?? []).map((row) => row.target_id as string)));
    setHidden(new Set((h.data ?? []).map((row) => row.target_id as string)));
  }, [user]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const isBlocked = useCallback((userId: string | null | undefined) => !!userId && blocked.has(userId), [blocked]);

  const coverFor = useCallback(
    (targetId: string, ownerId: string | null | undefined): CoverKind | null => {
      if (ownerId && blocked.has(ownerId)) return 'blocked';
      if (reported.has(targetId)) return 'reported';
      if (hidden.has(targetId)) return ownerId && ownerId === user?.id ? 'mine' : 'hidden';
      return null;
    },
    [blocked, reported, hidden, user?.id]
  );

  const block = async (userId: string) => {
    if (!user) return false;
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: userId });
    // Already blocked counts as done
    if (error && error.code !== '23505') {
      Alert.alert('Couldn’t block them', error.message);
      return false;
    }
    setBlocked((prev) => new Set(prev).add(userId));
    return true;
  };

  const unblock = async (userId: string) => {
    if (!user) return false;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
    if (error) {
      Alert.alert('Couldn’t unblock them', error.message);
      return false;
    }
    setBlocked((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    return true;
  };

  const confirmBlock = (userId: string, username: string, onDone?: () => void) => {
    Alert.alert(
      `Block ${username}?`,
      'Ocho will keep their photos, comments and notifications away from you, and you won’t be friends anymore. They won’t be told.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => (await block(userId)) && onDone?.() },
      ]
    );
  };

  const confirmUnblock = (userId: string, username: string, onDone?: () => void) => {
    Alert.alert(`Unblock ${username}?`, 'Their photos and comments will show up for you again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: async () => (await unblock(userId)) && onDone?.() },
    ]);
  };

  const openContentMenu = (target: ReportTarget, beforeReport?: () => void) => {
    Alert.alert(`${target.username}’s ${NOUN[target.kind]}`, undefined, [
      {
        text: `Report ${NOUN[target.kind]}`,
        onPress: () => {
          // A sheet can't open over another one, so close it first
          if (beforeReport) {
            beforeReport();
            setTimeout(() => setReportTarget(target), 450);
          } else {
            setReportTarget(target);
          }
        },
      },
      { text: `Block ${target.username}`, style: 'destructive', onPress: () => confirmBlock(target.userId, target.username) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Called by the sheet; a repeat report of the same thing counts as sent
  const submitReport = async (target: ReportTarget, reason: string, details: string) => {
    if (!user) return 'Not signed in';
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      kind: target.kind,
      target_id: target.id,
      target_user_id: target.userId,
      reason,
      details: details.trim() || null,
    });
    if (error && error.code !== '23505') return error.message;
    setReported((prev) => new Set(prev).add(target.id));
    return null;
  };

  return (
    <ModerationContext.Provider
      value={{
        blocked,
        isBlocked,
        coverFor,
        openReport: setReportTarget,
        confirmBlock,
        confirmUnblock,
        openContentMenu,
        refresh,
      }}
    >
      {children}
      <ReportSheet
        target={reportTarget}
        onSubmit={submitReport}
        onBlock={(t) => confirmBlock(t.userId, t.username)}
        onClose={() => setReportTarget(null)}
      />
    </ModerationContext.Provider>
  );
}

export const useModeration = () => useContext(ModerationContext);

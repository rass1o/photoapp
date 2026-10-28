import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { countUnread, markAllRead } from '../lib/notifications';
import { useAuth } from './AuthContext';

type NotificationsValue = {
  unread: number;
  refreshUnread: () => Promise<void>;
  markAllRead: () => Promise<void>;
  // Bumped whenever a new notification arrives, so an open inbox can reload
  lastArrival: number;
};

const NotificationsContext = createContext<NotificationsValue>({
  unread: 0,
  refreshUnread: async () => {},
  markAllRead: async () => {},
  lastArrival: 0,
});

// Keeps the unread count for the bell and the Home tab badge: loads it on
// sign-in and when the app comes back to the foreground, and follows new
// notifications live through Realtime.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [lastArrival, setLastArrival] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) return setUnread(0);
    setUnread(await countUnread());
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    refreshUnread();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        // Realtime can't filter delete events (an un-like, an answered
        // request), so those are picked up by the foreground/inbox refreshes
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          refreshUnread();
          setLastArrival(Date.now());
        }
      )
      .subscribe();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnread();
    });

    return () => {
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [user, refreshUnread]);

  const markRead = useCallback(async () => {
    setUnread(0);
    await markAllRead();
  }, []);

  return (
    <NotificationsContext.Provider value={{ unread, refreshUnread, markAllRead: markRead, lastArrival }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

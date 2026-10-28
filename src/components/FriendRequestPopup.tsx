import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Image, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  FriendRequest,
  loadFriendRequest,
  loadIncomingRequests,
  notifyFriendsChanged,
  respondToRequest,
} from '../lib/friends';
import { Text } from './Themed';
import { colors } from '../theme';

const SEEN_KEY = 'seenFriendRequests';

// Slides down from the top whenever someone sends you a friend request,
// whether it arrives live or was waiting when you opened the app. It's a
// plain overlay rather than a <Modal> so it can never stack with Home's
// modals (iOS only presents one modal at a time). Each request pops up
// once; it stays under Profile → Friends → Requests until you answer it.
export default function FriendRequestPopup() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<FriendRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const seenRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((requests: FriendRequest[]) => {
    const fresh = requests.filter((r) => !seenRef.current.has(r.id));
    if (fresh.length === 0) return;
    setQueue((prev) => [...prev, ...fresh.filter((r) => !prev.some((p) => p.id === r.id))]);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SEEN_KEY);
        seenRef.current = new Set(stored ? (JSON.parse(stored) as string[]) : []);
      } catch {
        seenRef.current = new Set();
      }
      const pending = await loadIncomingRequests(user.id);
      if (!cancelled) enqueue(pending.reverse()); // oldest first
    })();

    const channel = supabase
      .channel(`friend-requests:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` },
        async (payload) => {
          notifyFriendsChanged();
          const request = await loadFriendRequest((payload.new as { id: string }).id);
          if (request && !cancelled) enqueue([request]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, enqueue]);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [current, slide]);

  const dismiss = () => {
    if (!current) return;
    seenRef.current.add(current.id);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current].slice(-200))).catch(() => {});
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setQueue((prev) => prev.slice(1));
    });
  };

  const respond = async (accept: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await respondToRequest(current.id, accept);
    } catch (err) {
      // Already handled elsewhere (or cancelled by the sender): just move on
      console.log('Friend request response failed:', err);
    }
    setBusy(false);
    dismiss();
  };

  if (!current) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          {current.from.avatar_url ? (
            <Image source={{ uri: current.from.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.initials}>{current.from.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.textCol}>
            <Text style={styles.kicker}>Friend request</Text>
            <Text style={styles.message}>
              <Text style={styles.username}>{current.from.username}</Text> wants to be your friend. Shell we?
            </Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.declineButton]} onPress={() => respond(false)} disabled={busy}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.acceptButton]} onPress={() => respond(true)} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.acceptText}>Accept</Text>}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 10 },
  card: {
    backgroundColor: colors.shell,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 2,
    borderColor: colors.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 13, fontWeight: '600', color: colors.coral },
  textCol: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  message: { fontSize: 13, color: colors.text, marginTop: 2 },
  username: { fontWeight: '700', color: colors.deep },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  declineButton: { borderWidth: 1, borderColor: colors.sandBorder },
  declineText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  acceptButton: { backgroundColor: colors.deep },
  acceptText: { fontSize: 13, color: colors.white, fontWeight: '600' },
});

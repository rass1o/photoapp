import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Themed';
import { AppNotification, loadNotifications, timeAgo } from '../lib/notifications';
import { respondToRequest } from '../lib/friends';
import { useNotifications } from '../context/NotificationsContext';
import { colors, bubbly } from '../theme';
import { OchoPlain } from './OchoArt';
import OchoLoader from './OchoLoader';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenSubmission: (submissionId: string) => void;
  onOpenProfile: (userId: string) => void;
};

const TYPE_ICON: Record<AppNotification['type'], { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  like: { name: 'heart', color: '#dc2626' },
  vote: { name: 'star', color: '#F59E0B' },
  comment: { name: 'chatbubble', color: colors.reef },
  friend_request: { name: 'person-add', color: colors.deep },
  friend_accepted: { name: 'people', color: '#047857' },
  report_update: { name: 'search', color: colors.reef },
};

function message(n: AppNotification) {
  switch (n.type) {
    case 'like':
      return ' liked your photo';
    case 'vote':
      return ' voted for your photo';
    case 'comment':
      return ' commented: ';
    case 'friend_request':
      return ' sent you a friend request';
    case 'friend_accepted':
      return ' accepted your friend request. You’re in the same school now!';
    case 'report_update':
      return '';
    default:
      return ' did something new';
  }
}

// A type this version doesn't know yet gets a plain bell instead of crashing
// the sheet (old builds crashed here when likes came back)
const FALLBACK_ICON = { name: 'notifications' as const, color: colors.deep };

// Bottom sheet inbox: likes, comments and friend activity, newest first.
// Opening it marks everything read; unread rows keep their dot while open.
export default function NotificationsModal({ visible, onClose, onOpenSubmission, onOpenProfile }: Props) {
  const { markAllRead, lastArrival } = useNotifications();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setItems(await loadNotifications());
    setIsLoading(false);
    markAllRead();
  }, [markAllRead]);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    load();
  }, [visible, load]);

  // Something new arrived while the inbox is open
  useEffect(() => {
    if (visible && lastArrival) load();
  }, [lastArrival]);

  const respond = async (n: AppNotification, accept: boolean) => {
    if (!n.friendshipId) return;
    setBusyIds((prev) => new Set(prev).add(n.id));
    try {
      await respondToRequest(n.friendshipId, accept);
    } catch (err) {
      Alert.alert('Couldn’t do that', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(n.id);
      return next;
    });
    load();
  };

  const openItem = (n: AppNotification) => {
    if (n.type === 'report_update') return;
    if (n.submissionId) onOpenSubmission(n.submissionId);
    else onOpenProfile(n.actor.id);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifications</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ marginVertical: 20 }}>
            <OchoLoader size={52} message="Ocho is checking the mail…" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                All quiet on the seafloor. Likes, comments, friend requests and updates from Ocho will wash up here.
              </Text>
            }
            renderItem={({ item: n }) => {
              const icon = TYPE_ICON[n.type] ?? FALLBACK_ICON;
              const busy = busyIds.has(n.id);
              return (
                <Pressable style={[styles.row, !n.read && styles.rowUnread]} onPress={() => openItem(n)}>
                  <Pressable onPress={() => n.type !== 'report_update' && onOpenProfile(n.actor.id)}>
                    {n.type === 'report_update' ? (
                      <View style={[styles.avatar, styles.ochoAvatar]}>
                        <OchoPlain size={30} />
                      </View>
                    ) : n.actor.avatar_url ? (
                      <Image source={{ uri: n.actor.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.initials}>{(n.actor.username ?? '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.typeBadge}>
                      <Ionicons name={icon.name} size={10} color={icon.color} />
                    </View>
                  </Pressable>

                  <View style={styles.textCol}>
                    <Text style={styles.text} numberOfLines={3}>
                      <Text style={styles.username}>{n.type === 'report_update' ? 'Ocho' : n.actor.username}</Text>
                      {message(n)}
                      {n.type === 'report_update' && n.body ? ` ${n.body.replace(/^Ocho /, '')}` : null}
                      {n.type === 'comment' && n.body ? <Text style={styles.quote}>{`“${n.body}”`}</Text> : null}
                      <Text style={styles.time}>{`  ${timeAgo(n.createdAt)}`}</Text>
                    </Text>

                    {n.type === 'friend_request' && (
                      <View style={styles.requestButtons}>
                        <Pressable
                          style={[styles.smallButton, styles.acceptButton, busy && styles.busy]}
                          onPress={() => respond(n, true)}
                          disabled={busy}
                        >
                          <Text style={styles.acceptText}>Accept</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.smallButton, styles.declineButton, busy && styles.busy]}
                          onPress={() => respond(n, false)}
                          disabled={busy}
                        >
                          <Text style={styles.declineText}>Decline</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {n.imageUrl ? <Image source={{ uri: n.imageUrl }} style={styles.thumb} /> : null}
                  {!n.read && <View style={styles.unreadDot} />}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sandDark,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  title: { ...bubbly, fontSize: 22 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 30, paddingHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: colors.sandBorder,
  },
  rowUnread: { backgroundColor: colors.reefLight, borderRadius: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontWeight: '600', color: colors.coral },
  ochoAvatar: { backgroundColor: colors.reefLight, overflow: 'hidden' },
  typeBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.sandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  text: { fontSize: 13, color: colors.text, lineHeight: 18 },
  username: { fontWeight: '600', color: colors.ink },
  quote: { color: colors.ink },
  time: { color: colors.faint, fontSize: 12 },
  requestButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  acceptButton: { backgroundColor: colors.deep },
  acceptText: { fontSize: 12, fontWeight: '600', color: colors.white },
  declineButton: { borderWidth: 1, borderColor: colors.sandBorder },
  declineText: { fontSize: 12, fontWeight: '600', color: colors.text },
  busy: { opacity: 0.5 },
  thumb: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.sand },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.reef },
});

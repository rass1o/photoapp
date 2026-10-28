import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Themed';
import { AppNotification, loadNotifications, timeAgo } from '../lib/notifications';
import { respondToRequest } from '../lib/friends';
import { useNotifications } from '../context/NotificationsContext';
import { colors, bubbly } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenSubmission: (submissionId: string) => void;
  onOpenProfile: (userId: string) => void;
};

const TYPE_ICON: Record<AppNotification['type'], { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  vote: { name: 'heart', color: '#dc2626' },
  comment: { name: 'chatbubble', color: colors.reef },
  friend_request: { name: 'person-add', color: colors.deep },
  friend_accepted: { name: 'people', color: '#047857' },
};

function message(n: AppNotification) {
  switch (n.type) {
    case 'vote':
      return ' liked your photo';
    case 'comment':
      return ' commented: ';
    case 'friend_request':
      return ' sent you a friend request';
    case 'friend_accepted':
      return ' accepted your friend request. You’re in the same school now!';
  }
}

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
          <ActivityIndicator style={{ marginVertical: 30 }} color={colors.deep} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                All quiet on the seafloor. Likes, comments and friend requests will wash up here.
              </Text>
            }
            renderItem={({ item: n }) => {
              const icon = TYPE_ICON[n.type];
              const busy = busyIds.has(n.id);
              return (
                <Pressable style={[styles.row, !n.read && styles.rowUnread]} onPress={() => openItem(n)}>
                  <Pressable onPress={() => onOpenProfile(n.actor.id)}>
                    {n.actor.avatar_url ? (
                      <Image source={{ uri: n.actor.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.initials}>{n.actor.username.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.typeBadge}>
                      <Ionicons name={icon.name} size={10} color={icon.color} />
                    </View>
                  </Pressable>

                  <View style={styles.textCol}>
                    <Text style={styles.text} numberOfLines={3}>
                      <Text style={styles.username}>{n.actor.username}</Text>
                      {message(n)}
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

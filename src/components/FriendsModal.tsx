import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FriendProfile, FriendRequest } from '../lib/friends';

export type FriendsTab = 'friends' | 'requests';

type Props = {
  tab: FriendsTab | null; // null = closed
  friends: FriendProfile[];
  requests: FriendRequest[];
  busyIds: Set<string>; // request ids being answered
  onTabChange: (tab: FriendsTab) => void;
  onRespond: (request: FriendRequest, accept: boolean) => void;
  onOpenProfile: (userId: string) => void;
  onClose: () => void;
};

function Avatar({ profile }: { profile: FriendProfile }) {
  return profile.avatar_url ? (
    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
  ) : (
    <View style={styles.avatar}>
      <Text style={styles.initials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

// Bottom sheet on your Profile: your friends, and requests waiting on you
export default function FriendsModal({
  tab,
  friends,
  requests,
  busyIds,
  onTabChange,
  onRespond,
  onOpenProfile,
  onClose,
}: Props) {
  return (
    <Modal visible={tab !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Your school of fish</Text>
            <Text style={styles.title}>Friends</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="#374151" />
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, tab === 'friends' && styles.toggleActive]}
            onPress={() => onTabChange('friends')}
          >
            <Text style={tab === 'friends' ? styles.toggleTextActive : styles.toggleText}>
              Friends · {friends.length}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, tab === 'requests' && styles.toggleActive]}
            onPress={() => onTabChange('requests')}
          >
            <Text style={tab === 'requests' ? styles.toggleTextActive : styles.toggleText}>
              Requests{requests.length > 0 ? ` · ${requests.length}` : ''}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <Text style={styles.emptyText}>
                No friends yet. Open someone’s profile and tap Add friend. There are plenty of fish in the sea.
              </Text>
            ) : (
              friends.map((f) => (
                <Pressable key={f.id} style={styles.row} onPress={() => onOpenProfile(f.id)}>
                  <Avatar profile={f} />
                  <Text style={styles.username}>{f.username}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </Pressable>
              ))
            ))}

          {tab === 'requests' &&
            (requests.length === 0 ? (
              <Text style={styles.emptyText}>No friend requests right now.</Text>
            ) : (
              requests.map((r) => {
                const busy = busyIds.has(r.id);
                return (
                  <View key={r.id} style={styles.row}>
                    <Pressable style={styles.rowMain} onPress={() => onOpenProfile(r.from.id)}>
                      <Avatar profile={r.from} />
                      <Text style={styles.username} numberOfLines={1}>
                        {r.from.username}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, styles.declineButton]}
                      onPress={() => onRespond(r, false)}
                      disabled={busy}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, styles.acceptButton, busy && styles.buttonBusy]}
                      onPress={() => onRespond(r, true)}
                      disabled={busy}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </Pressable>
                  </View>
                );
              })
            ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11, 20, 24, 0.45)' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#6b7280', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: '#0B1418' },

  toggleRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 2, marginBottom: 10 },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleActive: { backgroundColor: '#ffffff' },
  toggleText: { fontSize: 13, color: '#46606B' },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: '#0B1418' },

  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontWeight: '600', color: '#6d28d9' },
  username: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  smallButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  declineButton: { borderWidth: 1, borderColor: '#e5e7eb' },
  declineText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  acceptButton: { backgroundColor: '#0B1418' },
  acceptText: { fontSize: 12, color: '#ffffff', fontWeight: '600' },
  buttonBusy: { opacity: 0.5 },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10 },
});

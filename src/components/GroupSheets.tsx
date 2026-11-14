import { ReactNode, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Text, TextInput } from './Themed';
import Stamp from './Stamp';
import { colors, bubbly } from '../theme';
import { loadFriends, FriendProfile } from '../lib/friends';
import {
  Group,
  GroupMember,
  createGroup,
  joinGroup,
  inviteToGroup,
  loadMembers,
  loadPendingInviteeIds,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
} from '../lib/groups';

// The bottom sheets around a group: starting or joining one, inviting
// friends, and the member list (where the owner can remove people).

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function shareGroupCode(group: Pick<Group, 'name' | 'invite_code'>) {
  Share.share({
    message: `Join my ShuttInk group "${group.name}"! In ShuttInk, open Groups on the Home tab and enter the code ${group.invite_code}.`,
  });
}

// ------------------------------------------------------------ start or join

export function StartOrJoinSheet({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (groupId: string) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setCode('');
    }
  }, [visible]);

  const start = async () => {
    if (!name.trim()) return;
    setBusy('start');
    try {
      const group = await createGroup(name);
      onDone(group.id);
    } catch (err) {
      Alert.alert('Couldn’t start the group', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusy(null);
  };

  const join = async () => {
    if (code.trim().length < 6) return;
    setBusy('join');
    try {
      const group = await joinGroup(code);
      onDone(group.id);
    } catch (err) {
      Alert.alert('Couldn’t join', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusy(null);
  };

  return (
    <Sheet visible={visible} title="Groups" onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
        <Text style={styles.sectionLabel}>Start a group</Text>
        <Text style={styles.hint}>
          You set the group’s themes and when photos and voting close. Share the code, or invite friends from the app.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Group name, like Photo 101"
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
        <Pressable style={[styles.primaryButton, (!name.trim() || busy) && styles.disabled]} onPress={start} disabled={!name.trim() || !!busy}>
          {busy === 'start' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Start group</Text>}
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Join with a code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="ABC123"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <Pressable
          style={[styles.secondaryButton, (code.length < 6 || busy) && styles.disabled]}
          onPress={join}
          disabled={code.length < 6 || !!busy}
        >
          {busy === 'join' ? <ActivityIndicator color={colors.deep} /> : <Text style={styles.secondaryText}>Join group</Text>}
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

// ------------------------------------------------------------------ invite

export function InviteSheet({
  visible,
  group,
  myId,
  onClose,
}: {
  visible: boolean;
  group: Group;
  myId: string;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<FriendProfile[] | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFriends(null);
    setCopied(false);
    Promise.all([loadFriends(myId), loadMembers(group.id), loadPendingInviteeIds(group.id)]).then(([f, members, pending]) => {
      setFriends(f);
      setMemberIds(new Set(members.map((m) => m.id)));
      setInvited(pending);
    });
  }, [visible, group.id, myId]);

  const invite = async (friend: FriendProfile) => {
    setBusyId(friend.id);
    try {
      await inviteToGroup(group.id, friend.id);
      setInvited((prev) => new Set(prev).add(friend.id));
    } catch (err) {
      Alert.alert('Couldn’t invite', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusyId(null);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(group.invite_code);
    setCopied(true);
  };

  return (
    <Sheet visible={visible} title="Invite people" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <View style={styles.codeCard}>
          <Text style={styles.hint}>Anyone with this code can join {group.name}</Text>
          <Stamp style={styles.bigCode}>{group.invite_code}</Stamp>
          <View style={styles.codeButtons}>
            <Pressable style={styles.smallButton} onPress={copy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={colors.deep} />
              <Text style={styles.smallButtonText}>{copied ? 'Copied' : 'Copy code'}</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => shareGroupCode(group)}>
              <Ionicons name="share-outline" size={15} color={colors.deep} />
              <Text style={styles.smallButtonText}>Share</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Your friends</Text>
        {friends === null ? (
          <ActivityIndicator color={colors.deep} style={{ marginVertical: 16 }} />
        ) : friends.length === 0 ? (
          <Text style={styles.hint}>Add friends from their profiles, and they’ll show up here. Or share the code above.</Text>
        ) : (
          friends.map((f) => {
            const inGroup = memberIds.has(f.id);
            const sent = invited.has(f.id);
            return (
              <View key={f.id} style={styles.personRow}>
                {f.avatar_url ? <Image source={{ uri: f.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar} />}
                <Text style={styles.personName}>{f.username}</Text>
                {inGroup ? (
                  <Text style={styles.statusText}>In the group</Text>
                ) : sent ? (
                  <Text style={styles.statusText}>Invited</Text>
                ) : (
                  <Pressable style={[styles.inviteButton, busyId === f.id && styles.disabled]} onPress={() => invite(f)} disabled={busyId === f.id}>
                    <Text style={styles.inviteText}>Invite</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

// ----------------------------------------------------------------- members

export function MembersSheet({
  visible,
  group,
  myId,
  onClose,
  onOpenProfile,
  onLeft,
}: {
  visible: boolean;
  group: Group;
  myId: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onLeft: () => void; // you left, or deleted the group
}) {
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const isOwner = group.owner_id === myId;

  const load = () => loadMembers(group.id).then(setMembers);

  useEffect(() => {
    if (!visible) return;
    setMembers(null);
    load();
  }, [visible, group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (m: GroupMember) =>
    Alert.alert(`Remove ${m.username}?`, 'Their photos and votes in this group will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeGroupMember(group.id, m.id);
            load();
          } catch (err) {
            Alert.alert('Couldn’t remove', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);

  const leaveOrDelete = () =>
    Alert.alert(
      isOwner ? `Delete ${group.name}?` : `Leave ${group.name}?`,
      isOwner
        ? 'This deletes the group for everyone, with all of its themes, photos and votes. It can’t be undone.'
        : 'Your photos and votes in this group will be removed. You can rejoin with the code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Delete group' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await (isOwner ? deleteGroup(group.id) : leaveGroup(group.id));
              onLeft();
            } catch (err) {
              Alert.alert('Couldn’t do that', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ]
    );

  return (
    <Sheet visible={visible} title={`${group.name} · ${members?.length ?? group.memberCount} members`} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        {members === null ? (
          <ActivityIndicator color={colors.deep} style={{ marginVertical: 16 }} />
        ) : (
          members.map((m) => (
            <Pressable key={m.id} style={styles.personRow} onPress={() => onOpenProfile(m.id)}>
              {m.avatar_url ? <Image source={{ uri: m.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar} />}
              <Text style={styles.personName}>{m.username}</Text>
              {m.id === group.owner_id && (
                <View style={styles.ownerTag}>
                  <Text style={styles.ownerTagText}>Runs the group</Text>
                </View>
              )}
              {isOwner && m.id !== myId && (
                <Pressable hitSlop={10} onPress={() => remove(m)}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>
          ))
        )}

        <Pressable style={styles.dangerButton} onPress={leaveOrDelete}>
          <Text style={styles.dangerText}>{isOwner ? 'Delete group' : 'Leave group'}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

export const sheetStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: colors.coral,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: colors.sand,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.deep },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  disabled: { opacity: 0.5 },
});

const styles = StyleSheet.create({
  ...sheetStyles,
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.sandDark, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { ...bubbly, fontSize: 20, flex: 1, marginRight: 10 },
  sheetBody: { gap: 10, paddingBottom: 20 },
  divider: { height: 1, backgroundColor: colors.sandBorder, marginVertical: 8 },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.deep,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryText: { color: colors.deep, fontSize: 15, fontWeight: '600' },
  codeCard: { backgroundColor: colors.sand, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8 },
  bigCode: { fontSize: 34, letterSpacing: 8 },
  codeButtons: { flexDirection: 'row', gap: 10 },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.shell,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallButtonText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sand },
  personName: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.ink },
  statusText: { fontSize: 13, color: colors.muted },
  inviteButton: { backgroundColor: colors.reef, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  inviteText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  ownerTag: { backgroundColor: colors.reefLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  ownerTagText: { fontSize: 11, fontWeight: '600', color: colors.reefDark },
  dangerButton: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  dangerText: { color: '#B91C1C', fontSize: 15, fontWeight: '600' },
});

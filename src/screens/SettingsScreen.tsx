import { ReactNode, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { useReplayIntro, useSettings } from '../context/SettingsContext';
import { supabase } from '../lib/supabase';
import { passwordOk } from '../lib/password';
import { Text, TextInput } from '../components/Themed';
import BackBar from '../components/BackBar';
import SandGrain from '../components/SandGrain';
import PasswordRules from '../components/PasswordRules';
import { colors, bubbly } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type IoniconName = keyof typeof Ionicons.glyphMap;

// Shown under Help & support when set; leave empty to hide the row
const SUPPORT_EMAIL = 'support@shuttink.app';
const SUPPORT_URL = 'https://shuttink.app/support';
const PRIVACY_URL = 'https://shuttink.app/privacy';

type Sheet = 'username' | 'bio' | 'password' | 'feedback' | 'privacy' | 'delete' | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  right,
  last,
}: {
  icon: IoniconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && onPress && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={danger ? '#b91c1c' : colors.reef} />
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null)}
    </Pressable>
  );
}

// Small note under a row, for things that need a word of explanation
function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

// Card that slides up over the screen to edit one thing
function EditSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { settings, setSetting } = useSettings();
  const replayIntro = useReplayIntro();

  const [profile, setProfile] = useState<{ username: string; bio: string } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');
  const [draft2, setDraft2] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'feedback' | 'problem'>('feedback');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('username, bio')
      .eq('id', user.id)
      .single()
      .then(({ data }) => data && setProfile({ username: data.username, bio: data.bio ?? '' }));
  }, [user]);

  const open = (next: Sheet, initial = '') => {
    setDraft(initial);
    setDraft2('');
    setError('');
    setDone('');
    setSheet(next);
  };
  const close = () => {
    if (!busy) setSheet(null);
  };

  const saveUsername = async () => {
    if (!user || !profile) return;
    const name = draft.trim();
    if (!/^[A-Za-z0-9_.]{2,20}$/.test(name)) {
      setError('2 to 20 letters, numbers, dots or underscores');
      return;
    }
    if (name === profile.username) return setSheet(null);
    setBusy(true);
    setError('');
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .neq('id', user.id)
      .limit(1);
    if (taken && taken.length > 0) {
      setBusy(false);
      setError('That username is taken');
      return;
    }
    const { error: err } = await supabase.from('profiles').update({ username: name }).eq('id', user.id);
    if (!err) await supabase.auth.updateUser({ data: { username: name } });
    setBusy(false);
    if (err) return setError(err.message.includes('duplicate') ? 'That username is taken' : err.message);
    setProfile({ ...profile, username: name });
    setSheet(null);
  };

  const saveBio = async () => {
    if (!user || !profile) return;
    setBusy(true);
    const bio = draft.trim();
    const { error: err } = await supabase.from('profiles').update({ bio }).eq('id', user.id);
    setBusy(false);
    if (err) return setError(err.message);
    setProfile({ ...profile, bio });
    setSheet(null);
  };

  const savePassword = async () => {
    if (!passwordOk(draft)) return setError('Your password needs everything on the list');
    if (draft !== draft2) return setError('The two passwords don’t match');
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password: draft });
    setBusy(false);
    if (err) return setError(err.message);
    setDone('Password changed.');
  };

  const sendFeedback = async () => {
    if (!user) return;
    const message = draft.trim();
    if (!message) return setError('Write a few words first');
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('feedback').insert({ user_id: user.id, kind: feedbackKind, message });
    setBusy(false);
    if (err) return setError('Couldn’t send that. Check your connection and try again.');
    setDraft('');
    setDone('Thanks! We read every message.');
  };

  const deleteAccount = async () => {
    if (draft.trim().toUpperCase() !== 'DELETE') return setError('Type DELETE to confirm');
    if (!user) return;
    setBusy(true);
    setError('');
    // Photo files live under <user id>/ in both buckets; clear them before
    // the account goes (best effort: the account is deleted either way)
    for (const bucket of ['submissions', 'avatars']) {
      const { data: files } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (files && files.length > 0) {
        await supabase.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
      }
    }
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    setBusy(false);
    setSheet(null);
    await signOut();
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <SandGrain />
      <BackBar title="Settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          <Row icon="at-outline" label="Username" value={profile?.username} onPress={() => open('username', profile?.username)} />
          <Row icon="mail-outline" label="Email" value={user?.email} />
          <Row icon="key-outline" label="Change password" onPress={() => open('password')} last />
        </Section>

        <Section title="Profile">
          <Row icon="create-outline" label="Bio" value={profile?.bio || 'Add a bio'} onPress={() => open('bio', profile?.bio)} />
          <Row
            icon="color-palette-outline"
            label="Photo, frame, banner & badge"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
          />
          <Row icon="happy-outline" label="Customize your octopus" onPress={() => navigation.push('Octopus')} last />
        </Section>

        <Section title="Notifications & alerts">
          <Row
            icon="person-add-outline"
            label="Friend request pop-ups"
            right={
              <Switch
                value={settings.friendPopups}
                onValueChange={(v) => setSetting('friendPopups', v)}
                trackColor={{ true: colors.reef, false: colors.sandDark }}
              />
            }
          />
          <Row
            icon="notifications-outline"
            label="Activity"
            value="Bell on Home"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            last
          />
        </Section>
        <Note>
          Votes, comments, friend requests and prize payouts show under the bell on Home. Phone notifications are coming
          in a future version.
        </Note>

        <Section title="Display">
          <Row
            icon="sparkles-outline"
            label="Animated Ocho & sidekicks"
            right={
              <Switch
                value={settings.animations}
                onValueChange={(v) => setSetting('animations', v)}
                trackColor={{ true: colors.reef, false: colors.sandDark }}
              />
            }
            last
          />
        </Section>
        <Note>Turn off to keep them still, which can also save a little battery.</Note>

        <Section title="Help & support">
          <Row icon="play-circle-outline" label="Replay the intro" onPress={replayIntro} />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            onPress={() => {
              setFeedbackKind('feedback');
              open('feedback');
            }}
          />
          <Row
            icon="bug-outline"
            label="Report a problem"
            onPress={() => {
              setFeedbackKind('problem');
              open('feedback');
            }}
          />
          <Row icon="help-buoy-outline" label="Help center" onPress={() => Linking.openURL(SUPPORT_URL)} />
          {SUPPORT_EMAIL ? (
            <Row
              icon="mail-open-outline"
              label="Contact"
              value={SUPPORT_EMAIL}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              last
            />
          ) : null}
        </Section>

        <Section title="Privacy">
          <Row icon="shield-checkmark-outline" label="Your data & privacy" onPress={() => open('privacy')} />
          <Row icon="document-text-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row icon="trash-outline" label="Delete account" danger onPress={() => open('delete')} last />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" label="ShuttInk" value={`Version ${version}`} last />
        </Section>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={17} color="#b91c1c" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <EditSheet visible={sheet === 'username'} title="Username" onClose={close}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          autoFocus
        />
        <Text style={styles.hint}>Everyone sees this on your photos and profile.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SaveButton label="Save" busy={busy} onPress={saveUsername} />
      </EditSheet>

      <EditSheet visible={sheet === 'bio'} title="Bio" onClose={close}>
        <TextInput style={styles.input} value={draft} onChangeText={setDraft} maxLength={80} autoFocus placeholder="Add a bio" />
        <Text style={styles.hint}>{80 - draft.length} characters left</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SaveButton label="Save" busy={busy} onPress={saveBio} />
      </EditSheet>

      <EditSheet visible={sheet === 'password'} title="Change password" onClose={close}>
        {done ? (
          <DoneNote text={done} onClose={close} />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              secureTextEntry
              placeholder="New password"
              placeholderTextColor={colors.faint}
              autoFocus
            />
            <PasswordRules password={draft} />
            <TextInput
              style={styles.input}
              value={draft2}
              onChangeText={setDraft2}
              secureTextEntry
              placeholder="Type it again"
              placeholderTextColor={colors.faint}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SaveButton label="Change password" busy={busy} onPress={savePassword} />
          </>
        )}
      </EditSheet>

      <EditSheet
        visible={sheet === 'feedback'}
        title={feedbackKind === 'problem' ? 'Report a problem' : 'Send feedback'}
        onClose={close}
      >
        {done ? (
          <DoneNote text={done} onClose={close} />
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
              autoFocus
              placeholder={
                feedbackKind === 'problem'
                  ? 'What went wrong? What were you doing when it happened?'
                  : 'Ideas, things you love, things that bug you…'
              }
              placeholderTextColor={colors.faint}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SaveButton label="Send" busy={busy} onPress={sendFeedback} />
          </>
        )}
      </EditSheet>

      <EditSheet visible={sheet === 'privacy'} title="Your data & privacy" onClose={close}>
        <ScrollView style={{ maxHeight: 360 }}>
          {[
            'Photos you post, your username, bio, avatar, octopus and streaks are visible to everyone who uses ShuttInk.',
            'Your email is only used to sign you in. Other people can’t see it.',
            'Your phone’s camera and photo library are only used when you choose to take or pick a photo.',
            'Feedback and problem reports you send are read by the ShuttInk team.',
            'You can delete your account at any time from this screen. That removes your photos, posts, votes, comments, friends, shutters and items from ShuttInk.',
          ].map((line) => (
            <View key={line} style={styles.privacyRow}>
              <View style={styles.privacyDot} />
              <Text style={styles.privacyText}>{line}</Text>
            </View>
          ))}
        </ScrollView>
      </EditSheet>

      <EditSheet visible={sheet === 'delete'} title="Delete account" onClose={close}>
        <Text style={styles.warning}>
          This permanently deletes your account and everything in it: photos, posts, votes, comments, friends, shutters,
          items and your octopus. It can{'’'}t be undone.
        </Text>
        <Text style={styles.hint}>Type DELETE to confirm.</Text>
        <TextInput style={styles.input} value={draft} onChangeText={setDraft} autoCapitalize="characters" autoCorrect={false} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SaveButton label="Delete my account" busy={busy} onPress={deleteAccount} danger />
      </EditSheet>
    </SafeAreaView>
  );
}

function SaveButton({ label, busy, onPress, danger }: { label: string; busy: boolean; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={[styles.saveButton, danger && styles.saveDanger, busy && { opacity: 0.6 }]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{label}</Text>}
    </Pressable>
  );
}

function DoneNote({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <View style={styles.doneBox}>
      <Ionicons name="checkmark-circle" size={36} color="#047857" />
      <Text style={styles.doneText}>{text}</Text>
      <SaveButton label="Done" busy={false} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.shell },
  content: { paddingHorizontal: 16, paddingBottom: 32 },

  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.sand, borderRadius: 12, borderWidth: 1, borderColor: colors.sandBorder, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.sandBorder },
  rowPressed: { backgroundColor: colors.sandLight },
  rowLabel: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: '500' },
  rowValue: { maxWidth: '45%', fontSize: 13, color: colors.muted },
  danger: { color: '#b91c1c' },
  note: { fontSize: 12, color: colors.muted, marginTop: 6, marginHorizontal: 6, lineHeight: 17 },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  signOutText: { fontSize: 14, color: '#b91c1c', fontWeight: '600' },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.shell, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { ...bubbly, fontSize: 22 },
  input: {
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    color: colors.ink,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  error: { color: '#b91c1c', fontSize: 12, marginBottom: 10 },
  warning: { fontSize: 14, color: colors.ink, lineHeight: 20, marginBottom: 12 },
  saveButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveDanger: { backgroundColor: '#b91c1c' },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  doneBox: { alignItems: 'center', gap: 10 },
  doneText: { fontSize: 14, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  privacyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  privacyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.reef, marginTop: 7 },
  privacyText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
});

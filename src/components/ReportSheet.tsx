import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from './Themed';
import { OchoStudy } from './OchoArt';
import { colors, bubbly, fonts } from '../theme';

// Bottom sheet for reporting a photo, comment or account: pick why, add a
// note if you like, and send. Then Ocho takes it from there.

export type ReportTarget = {
  kind: 'photo' | 'daily' | 'comment' | 'account';
  id: string; // the photo, comment or account
  userId: string; // whose it is
  username: string;
};

const CONTENT_REASONS = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'harassment', label: 'Bullying or harassment' },
  { key: 'hate', label: 'Hate speech or symbols' },
  { key: 'nudity', label: 'Nudity or sexual content' },
  { key: 'violence', label: 'Violence or dangerous acts' },
  { key: 'other', label: 'Something else' },
];

const ACCOUNT_REASONS = [
  { key: 'spam', label: 'Spam or a fake account' },
  { key: 'harassment', label: 'Bullying or harassing people' },
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'hate', label: 'Hateful username, bio or posts' },
  { key: 'nudity', label: 'Inappropriate photos or profile' },
  { key: 'underage', label: 'They’re under 13' },
  { key: 'other', label: 'Something else' },
];

type Props = {
  target: ReportTarget | null;
  // Returns an error message, or null once it's sent
  onSubmit: (target: ReportTarget, reason: string, details: string) => Promise<string | null>;
  onBlock: (target: ReportTarget) => void;
  onClose: () => void;
};

export default function ReportSheet({ target, onSubmit, onBlock, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Fresh form each time it opens
  useEffect(() => {
    if (!target) return;
    setReason(null);
    setDetails('');
    setError(null);
    setSent(false);
  }, [target]);

  if (!target) return null;
  const isAccount = target.kind === 'account';
  const noun = isAccount ? target.username : target.kind === 'comment' ? 'this comment' : 'this photo';
  const reasons = isAccount ? ACCOUNT_REASONS : CONTENT_REASONS;

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(target, reason, details);
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.flex} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          {sent ? (
            <View style={styles.thanks}>
              <OchoStudy size={130} />
              <Text style={styles.title}>Thanks, Ocho’s on it</Text>
              <Text style={styles.body}>
                {isAccount
                  ? `Ocho will look into ${target.username}’s account. We’ll keep you updated in your notifications.`
                  : `We’ve covered ${noun} for you while Ocho studies it. We’ll keep you updated in your notifications.`}
              </Text>
              <Pressable style={[styles.button, styles.blockButton]} onPress={() => onBlock(target)}>
                <Ionicons name="shield-outline" size={16} color={colors.coral} />
                <Text style={styles.blockText}>Also block {target.username}</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Report {isAccount ? target.username : noun}</Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.body}>
                What’s wrong with {noun}? Reports are private: {target.username} won’t know who sent it.
              </Text>

              {reasons.map((r) => {
                const on = reason === r.key;
                return (
                  <Pressable key={r.key} style={[styles.reason, on && styles.reasonOn]} onPress={() => setReason(r.key)}>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.reef : colors.faint} />
                    <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r.label}</Text>
                  </Pressable>
                );
              })}

              <TextInput
                style={styles.input}
                placeholder="Anything else Ocho should know? (optional)"
                placeholderTextColor={colors.faint}
                value={details}
                onChangeText={setDetails}
                maxLength={500}
                multiline
              />
              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable style={[styles.button, styles.sendButton, !reason && styles.disabled]} disabled={!reason || busy} onPress={send}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Send report</Text>}
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  flex: { flex: 1 },
  sheet: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.sandDark, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...bubbly, fontSize: 21, textAlign: 'center' },
  body: { fontSize: 13.5, color: colors.text, lineHeight: 19, marginTop: 6, marginBottom: 12 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.sand,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonOn: { backgroundColor: colors.reefLight, borderColor: colors.reefBorder },
  reasonText: { fontSize: 14, color: colors.text },
  reasonTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  input: {
    backgroundColor: colors.sand,
    borderRadius: 12,
    padding: 12,
    minHeight: 64,
    fontSize: 14,
    color: colors.ink,
    marginTop: 6,
    textAlignVertical: 'top',
  },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8 },
  button: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.sandBorder,
    alignSelf: 'stretch',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  sendButton: { backgroundColor: colors.coral, borderColor: colors.coral, marginBottom: 10 },
  sendText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
  disabled: { opacity: 0.45 },
  thanks: { alignItems: 'center', paddingBottom: 12 },
  blockButton: { borderColor: colors.coral, backgroundColor: colors.coralLight },
  blockText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.coral },
});

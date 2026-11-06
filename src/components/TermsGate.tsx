import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Linking, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './Themed';
import { OchoShield } from './OchoArt';
import { supabase } from '../lib/supabase';
import { colors, bubbly, fonts } from '../theme';

// Everyone has to agree to the Terms of Use (no abusive content, ever).
// New accounts tick the box at sign-up, which is recorded here once they're
// signed in; accounts made before the terms existed are asked once.

export const TERMS_URL = 'https://shuttink.app/terms';
export const TERMS_AGREED_KEY = (email: string) => `termsAgreed:${email.toLowerCase()}`;

const RULES = [
  'No bullying, harassment or threats',
  'No hate speech or hateful symbols',
  'No nudity or sexual content',
  'No violence, self-harm or dangerous acts',
  'No spam, scams or pretending to be someone else',
];

export default function TermsGate({ userId, email }: { userId: string; email: string }) {
  const [needed, setNeeded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('terms_accepted_at').eq('id', userId).maybeSingle();
      // If the column isn't there yet, don't lock anyone out
      if (stale || error || !data || data.terms_accepted_at) return;
      const agreedAtSignUp = await AsyncStorage.getItem(TERMS_AGREED_KEY(email)).catch(() => null);
      if (agreedAtSignUp) {
        await supabase.rpc('accept_terms');
        AsyncStorage.removeItem(TERMS_AGREED_KEY(email)).catch(() => {});
      } else if (!stale) {
        setNeeded(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, [userId, email]);

  const accept = async () => {
    setBusy(true);
    await supabase.rpc('accept_terms');
    setBusy(false);
    setNeeded(false);
  };

  return (
    <Modal visible={needed} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <OchoShield size={96} />
          <Text style={styles.title}>Keeping the reef kind</Text>
          <Text style={styles.body}>
            ShuttInk has Terms of Use now. Ocho has zero tolerance for abusive content or people. That means:
          </Text>
          {RULES.map((r) => (
            <View key={r} style={styles.rule}>
              <View style={styles.dot} />
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
          <Text style={styles.body}>
            Photos and comments that break these get removed, and so can the accounts that post them. You can report
            anything with ••• and block anyone.
          </Text>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.link}>Read the full Terms of Use</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={accept} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>I agree</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: colors.shell, borderRadius: 22, padding: 22, alignItems: 'center', width: '100%', maxWidth: 400 },
  title: { ...bubbly, fontSize: 23, textAlign: 'center', marginTop: 4 },
  body: { fontSize: 13.5, color: colors.text, lineHeight: 19, marginVertical: 8, alignSelf: 'stretch' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginVertical: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral },
  ruleText: { fontSize: 13.5, color: colors.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.reef, textDecorationLine: 'underline', marginVertical: 6 },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.deep,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 8,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});

import { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Text, TextInput } from '../components/Themed';
import PasswordRules from '../components/PasswordRules';
import Wordmark from '../components/Wordmark';
import { passwordOk } from '../lib/password';
import { colors, bubbly } from '../theme';

export default function AuthScreen() {
  const { signIn, signUp, resendConfirmation, authError } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once an account is made but waiting on its emailed confirmation link
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState('');

  const handleSubmit = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    if (mode === 'signIn' && password.length === 0) {
      setError('Enter your password');
      return;
    }
    if (mode === 'signUp' && !passwordOk(password)) {
      setError('Your password needs everything on the list above');
      return;
    }
    if (mode === 'signUp' && username.trim().length < 2) {
      setError('Enter a username');
      return;
    }

    setError('');
    setIsSubmitting(true);
    if (mode === 'signIn') {
      await signIn(email, password);
    } else if ((await signUp(email.trim(), username.trim(), password)) === 'confirm') {
      setPendingEmail(email.trim());
      setResendNote('');
    }
    setIsSubmitting(false);
  };

  const resend = async (address: string) => {
    setResendNote('Sending…');
    const failure = await resendConfirmation(address);
    setResendNote(failure ?? 'Sent! Check your inbox (and spam).');
  };

  // authError comes back from Supabase itself (e.g. "Invalid login credentials",
  // "User already registered") — show it alongside local validation errors.
  const displayError = error || authError;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.logo}>
            <Wordmark size={38} />
          </View>
          <Text style={styles.tagline}>A new theme every week. Shoot it your way.</Text>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeTab, mode === 'signIn' && styles.modeTabActive]}
              onPress={() => setMode('signIn')}
            >
              <Text style={[styles.modeText, mode === 'signIn' && styles.modeTextActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'signUp' && styles.modeTabActive]}
              onPress={() => setMode('signUp')}
            >
              <Text style={[styles.modeText, mode === 'signUp' && styles.modeTextActive]}>
                Sign up
              </Text>
            </Pressable>
          </View>

          {pendingEmail ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Check your inbox</Text>
              <Text style={styles.confirmText}>
                We sent a confirmation link to <Text style={styles.confirmEmail}>{pendingEmail}</Text>. Tap it to
                activate your account, then come back and sign in.
              </Text>
              {resendNote ? <Text style={styles.confirmNote}>{resendNote}</Text> : null}
              <Pressable
                style={styles.submitButton}
                onPress={() => {
                  setPendingEmail(null);
                  setMode('signIn');
                }}
              >
                <Text style={styles.submitText}>I{'’'}ve confirmed, sign in</Text>
              </Pressable>
              <Pressable onPress={() => resend(pendingEmail)} style={styles.linkButton}>
                <Text style={styles.linkText}>Didn{'’'}t get it? Send it again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {mode === 'signUp' && (
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.faint}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {mode === 'signUp' && <PasswordRules password={password} />}

              {displayError ? <Text style={styles.error}>{displayError}</Text> : null}
              {mode === 'signIn' && displayError?.startsWith('Confirm your email') && (
                <Pressable onPress={() => resend(email.trim())} style={styles.linkButton}>
                  <Text style={styles.linkText}>{resendNote || 'Send the confirmation link again'}</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitText}>
                  {isSubmitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { alignItems: 'center' },
  tagline: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.sandTrack,
    borderRadius: 8,
    padding: 2,
    marginBottom: 20,
  },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  modeTabActive: { backgroundColor: colors.shell },
  modeText: { fontSize: 13, color: colors.muted },
  modeTextActive: { fontSize: 13, fontWeight: '600', color: colors.deep },
  input: {
    backgroundColor: colors.shell,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.sandBorder,
  },
  error: { color: '#b91c1c', fontSize: 12, marginBottom: 10 },
  submitButton: {
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  submitButtonDisabled: { opacity: 0.6 },
  confirmCard: {
    backgroundColor: colors.shell,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    padding: 18,
  },
  confirmTitle: { ...bubbly, fontSize: 22, textAlign: 'center', marginBottom: 8 },
  confirmText: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  confirmEmail: { fontWeight: '600', color: colors.ink },
  confirmNote: { fontSize: 12, color: colors.reef, textAlign: 'center', marginBottom: 4 },
  linkButton: { alignSelf: 'center', paddingVertical: 10 },
  linkText: { fontSize: 13, color: colors.reef, fontWeight: '600' },
  submitText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
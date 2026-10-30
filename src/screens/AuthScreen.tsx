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
  const { signIn, signUp, resendConfirmation, verifySignupCode, sendPasswordReset, resetPasswordWithCode, authError } =
    useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once an account is made but waiting on its emailed 6-digit code
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Forgot password: 'email' asks where to send the code, 'code' takes the
  // code and the new password
  const [resetStep, setResetStep] = useState<'email' | 'code' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const startReset = () => {
    setResetStep('email');
    setCode('');
    setNewPassword('');
    setResetError('');
    setResendNote('');
  };

  const sendResetCode = async () => {
    const address = email.trim();
    if (!address.includes('@')) return setResetError('Enter the email on your account');
    setIsResetting(true);
    setResetError('');
    const failure = await sendPasswordReset(address);
    setIsResetting(false);
    if (failure) return setResetError(failure);
    setResetStep('code');
  };

  const finishReset = async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length < 6) return setResetError('Enter the full code from the email');
    if (!passwordOk(newPassword)) return setResetError('Your new password needs everything on the list');
    setIsResetting(true);
    setResetError('');
    // on success they're signed in and the app moves past this screen
    const failure = await resetPasswordWithCode(email.trim(), digits, newPassword);
    setIsResetting(false);
    if (failure) setResetError(failure);
  };

  const askForCode = (address: string) => {
    setPendingEmail(address);
    setCode('');
    setCodeError('');
    setResendNote('');
  };

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
      // An account that never entered its code gets a fresh one and the code screen
      if ((await signIn(email.trim(), password)) === 'unconfirmed') {
        askForCode(email.trim());
        resend(email.trim());
      }
    } else if ((await signUp(email.trim(), username.trim(), password)) === 'confirm') {
      askForCode(email.trim());
    }
    setIsSubmitting(false);
  };

  const verify = async () => {
    if (!pendingEmail) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length < 6) {
      setCodeError('Enter the full code from the email');
      return;
    }
    setIsVerifying(true);
    setCodeError('');
    const failure = await verifySignupCode(pendingEmail, digits);
    setIsVerifying(false);
    // on success the session arrives and the app moves past this screen
    if (failure) setCodeError(failure);
  };

  const resend = async (address: string) => {
    setResendNote('Sending…');
    const failure = await resendConfirmation(address);
    setResendNote(failure ?? 'Sent a new code. Check your inbox (and spam).');
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
              <Text style={styles.confirmTitle}>Enter your code</Text>
              <Text style={styles.confirmText}>
                We emailed a code to <Text style={styles.confirmEmail}>{pendingEmail}</Text>. Enter it below to
                finish setting up your account.
              </Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="123456"
                placeholderTextColor={colors.faint}
                autoFocus
              />
              {codeError ? <Text style={[styles.error, styles.centered]}>{codeError}</Text> : null}
              {resendNote ? <Text style={styles.confirmNote}>{resendNote}</Text> : null}
              <Pressable
                style={[styles.submitButton, isVerifying && styles.submitButtonDisabled]}
                onPress={verify}
                disabled={isVerifying}
              >
                <Text style={styles.submitText}>{isVerifying ? 'Checking\u2026' : 'Confirm'}</Text>
              </Pressable>
              <Pressable onPress={() => resend(pendingEmail)} style={styles.linkButton}>
                <Text style={styles.linkText}>Didn{'\u2019'}t get it? Send a new code</Text>
              </Pressable>
              <Pressable onPress={() => setPendingEmail(null)} style={styles.linkButtonTight}>
                <Text style={styles.backLinkText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : resetStep ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Reset your password</Text>
              {resetStep === 'email' ? (
                <>
                  <Text style={styles.confirmText}>Enter the email on your account and we{'\u2019'}ll send you a code.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    autoFocus
                  />
                  {resetError ? <Text style={[styles.error, styles.centered]}>{resetError}</Text> : null}
                  <Pressable
                    style={[styles.submitButton, isResetting && styles.submitButtonDisabled]}
                    onPress={sendResetCode}
                    disabled={isResetting}
                  >
                    <Text style={styles.submitText}>{isResetting ? 'Sending\u2026' : 'Send code'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.confirmText}>
                    If <Text style={styles.confirmEmail}>{email.trim()}</Text> has an account, a code is on its way.
                    Enter it and choose a new password.
                  </Text>
                  <TextInput
                    style={styles.codeInput}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={10}
                    placeholder="123456"
                    placeholderTextColor={colors.faint}
                    autoFocus
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="New password"
                    placeholderTextColor={colors.faint}
                    secureTextEntry
                    textContentType="newPassword"
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <PasswordRules password={newPassword} />
                  {resetError ? <Text style={[styles.error, styles.centered]}>{resetError}</Text> : null}
                  <Pressable
                    style={[styles.submitButton, isResetting && styles.submitButtonDisabled]}
                    onPress={finishReset}
                    disabled={isResetting}
                  >
                    <Text style={styles.submitText}>{isResetting ? 'Saving\u2026' : 'Set new password'}</Text>
                  </Pressable>
                  <Pressable onPress={sendResetCode} style={styles.linkButton}>
                    <Text style={styles.linkText}>Didn{'\u2019'}t get it? Send a new code</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setResetStep(null)} style={styles.linkButtonTight}>
                <Text style={styles.backLinkText}>Back to sign in</Text>
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

              <Pressable
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitText}>
                  {isSubmitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
              {mode === 'signIn' && (
                <Pressable onPress={startReset} style={styles.linkButton}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>
              )}
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
  linkButtonTight: { alignSelf: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 13, color: colors.muted },
  centered: { textAlign: 'center' },
  codeInput: {
    backgroundColor: colors.shell,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    paddingVertical: 12,
    marginVertical: 10,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
    fontWeight: '600',
  },
  linkText: { fontSize: 13, color: colors.reef, fontWeight: '600' },
  submitText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
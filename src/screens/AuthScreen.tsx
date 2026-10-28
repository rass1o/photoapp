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
import { colors, bubbly } from '../theme';

export default function AuthScreen() {
  const { signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters');
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
    } else {
      await signUp(email, username.trim(), password);
    }
    setIsSubmitting(false);
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
          <Text style={styles.logo}>ShuttInk</Text>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { ...bubbly, fontSize: 44, textAlign: 'center', textShadowOffset: { width: 0, height: 3 } },
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
  submitText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
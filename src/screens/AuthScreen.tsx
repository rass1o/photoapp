import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
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
    if (mode === 'signIn') {
      signIn(email, password);
    } else {
      signUp(email, username.trim(), password);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>Frames</Text>
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
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>
              {mode === 'signIn' ? 'Sign in' : 'Create account'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#D9E2E6' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { fontSize: 30, fontWeight: '700', color: '#0B1418', textAlign: 'center' },
  tagline: {
    fontSize: 13,
    color: '#46606B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8,
    padding: 2,
    marginBottom: 20,
  },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  modeTabActive: { backgroundColor: '#ffffff' },
  modeText: { fontSize: 13, color: '#46606B' },
  modeTextActive: { fontSize: 13, fontWeight: '600', color: '#0B1418' },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  error: { color: '#b91c1c', fontSize: 12, marginBottom: 10 },
  submitButton: {
    backgroundColor: '#0B1418',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});

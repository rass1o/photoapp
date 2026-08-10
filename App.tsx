import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';

function Root() {
  const { user, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setHasSeenOnboarding(value === 'true');
    });
  }, []);

  const finishOnboarding = () => {
    setHasSeenOnboarding(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  if (isLoading || hasSeenOnboarding === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0B1418" />
      </View>
    );
  }

  if (!user && !hasSeenOnboarding) {
    return <OnboardingScreen onDone={finishOnboarding} />;
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthScreen />}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9E2E6' },
});
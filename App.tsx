import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  useFonts,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import FriendRequestPopup from './src/components/FriendRequestPopup';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { colors } from './src/theme';

// Screens without their own background sit on warm shell instead of gray
const NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.reef,
    background: colors.shell,
    card: colors.shell,
    text: colors.ink,
    border: colors.sandBorder,
  },
};

const ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';

function Root() {
  const { user, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setHasSeenOnboarding(value === 'true');
    });
  }, []);

  const finishOnboarding = () => {
    setHasSeenOnboarding(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  // If the font fails to load, carry on with the system font rather than hang
  if (isLoading || hasSeenOnboarding === null || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.deep} />
      </View>
    );
  }

  if (!user && !hasSeenOnboarding) {
    return <OnboardingScreen onDone={finishOnboarding} />;
  }

  return (
    <NavigationContainer theme={NAV_THEME}>
      {user ? <AppNavigator /> : <AuthScreen />}
      {user && <FriendRequestPopup />}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <Root />
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sea },
});
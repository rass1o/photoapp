import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
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
import LaunchScreen, { LAUNCH_BG } from './src/components/LaunchScreen';
import TermsGate from './src/components/TermsGate';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { ModerationProvider } from './src/context/ModerationContext';
import { ReplayIntroContext, SettingsProvider, useSettings } from './src/context/SettingsContext';
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

// Onboarding is shown once per account, the first time it signs in here
const onboardingKey = (userId: string) => `hasSeenOnboarding:${userId}`;

function Root() {
  const { user, isLoading } = useAuth();
  const { settings } = useSettings();
  // Which account the check below is for, so a fresh sign-in waits on its own
  const [onboarding, setOnboarding] = useState<{ userId: string; seen: boolean } | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    AsyncStorage.getItem(onboardingKey(userId))
      .then((value) => setOnboarding({ userId, seen: value === 'true' }))
      .catch(() => setOnboarding({ userId, seen: true }));
  }, [user?.id]);

  const finishOnboarding = () => {
    if (!user) return;
    setOnboarding({ userId: user.id, seen: true });
    AsyncStorage.setItem(onboardingKey(user.id), 'true');
  };

  // From Settings: forget this account has seen the intro and show it now
  const replayIntro = () => {
    if (!user) return;
    AsyncStorage.removeItem(onboardingKey(user.id));
    setOnboarding({ userId: user.id, seen: false });
  };

  const checkingOnboarding = !!user && onboarding?.userId !== user.id;
  // If the font fails to load, carry on with the system font rather than hang
  const fontsReady = fontsLoaded || !!fontError;
  const ready = !isLoading && !checkingOnboarding && fontsReady;
  // The animated launch screen sits on top until everything's ready
  const [launching, setLaunching] = useState(true);

  let content = null;
  if (ready) {
    content =
      user && !onboarding?.seen ? (
        <OnboardingScreen onDone={finishOnboarding} />
      ) : (
        <ReplayIntroContext.Provider value={replayIntro}>
          <NavigationContainer theme={NAV_THEME}>
            {user ? <AppNavigator /> : <AuthScreen />}
            {user && settings.friendPopups && <FriendRequestPopup />}
            <StatusBar style={launching ? 'light' : 'auto'} />
          </NavigationContainer>
        </ReplayIntroContext.Provider>
      );
  }

  return (
    <View style={styles.root}>
      {content}
      {ready && !launching && user && <TermsGate userId={user.id} email={user.email} />}
      {launching && <LaunchScreen ready={ready} fontsReady={fontsReady} onDone={() => setLaunching(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <NotificationsProvider>
            <ModerationProvider>
              <Root />
            </ModerationProvider>
          </NotificationsProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LAUNCH_BG },
});
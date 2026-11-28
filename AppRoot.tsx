import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';
import {
  useFonts,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import FriendRequestPopup from './src/components/FriendRequestPopup';
import LaunchScreen, { LAUNCH_BG } from './src/components/LaunchScreen';
import TermsGate from './src/components/TermsGate';
import { initAnalytics, identifyUser, resetUser } from './src/lib/analytics';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { ModerationProvider } from './src/context/ModerationContext';
import { ReplayIntroContext, SettingsProvider, useSettings } from './src/context/SettingsContext';
import { colors, isDarkMode } from './src/theme';
import { TourProvider } from './src/context/TourContext';

// Screens without their own background sit on warm shell instead of gray
const NAV_THEME: Theme = {
  ...DefaultTheme,
  dark: isDarkMode(),
  colors: {
    ...DefaultTheme.colors,
    primary: colors.reef,
    background: colors.shell,
    card: colors.shell,
    text: colors.ink,
    border: colors.sandBorder,
  },
};

const navigationRef = createNavigationContainerRef<any>();

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
    ShareTechMono_400Regular,
  });

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    AsyncStorage.getItem(onboardingKey(userId))
      .then((value) => setOnboarding({ userId, seen: value === 'true' }))
      .catch(() => setOnboarding({ userId, seen: true }));
  }, [user?.id]);

  // PostHog: initialize analytics and sync identity with auth state
  // ATT: prompt iOS tracking transparency for ad personalization
  useEffect(() => {
    initAnalytics();
    // Native code that older builds and Expo Go don't have, so only if it's there
    if (Platform.OS === 'ios') {
      try {
        require('expo-tracking-transparency').requestTrackingPermissionsAsync().catch(() => {});
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (user) {
      identifyUser(user.id, { email: user.email, username: user.username });
    } else {
      resetUser();
    }
  }, [user?.id]);

  // The walkthrough of the tabs follows the intro pages (and replays with them)
  const [tourNext, setTourNext] = useState(false);

  const finishOnboarding = () => {
    if (!user) return;
    setTourNext(true);
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
          <NavigationContainer theme={NAV_THEME} ref={navigationRef}>
            {user ? (
              <TourProvider
                autoStart={tourNext && !launching}
                onAutoStarted={() => setTourNext(false)}
                navigationRef={navigationRef}
              >
                <AppNavigator />
              </TourProvider>
            ) : (
              <AuthScreen />
            )}
            {user && settings.friendPopups && <FriendRequestPopup />}
            <StatusBar style={launching || isDarkMode() ? 'light' : 'dark'} />
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

// Loaded by App.tsx once the light or dark colors are in place
export default function AppRoot() {
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
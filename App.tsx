import { useEffect, useState, type ComponentType } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { applyColorMode, COLOR_MODE_KEY } from './src/theme';

// Keep the splash up through this short wait; LaunchScreen hides it
SplashScreen.preventAutoHideAsync().catch(() => {});

// Screens read the app's colors once, when their styles are created, so the
// saved light or dark choice is applied first and only then is the rest of
// the app loaded (AppRoot.tsx). Keep this file's imports to these few.
export default function App() {
  const [Root, setRoot] = useState<ComponentType | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(COLOR_MODE_KEY)
      .catch(() => null)
      .then((mode) => {
        applyColorMode(mode === 'dark' ? 'dark' : 'light');
        setRoot(() => require('./AppRoot').default);
      });
  }, []);

  return Root ? <Root /> : null;
}

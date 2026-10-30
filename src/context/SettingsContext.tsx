import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// App preferences from the Settings screen, kept on this phone
export type Settings = {
  friendPopups: boolean; // slide-down pop-up when a friend request arrives
  animations: boolean; // Ocho and sidekicks move (off = they hold still)
};

const DEFAULTS: Settings = { friendPopups: true, animations: true };
const STORAGE_KEY = 'settings';

type SettingsContextValue = {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULTS, setSetting: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {});
  }, []);

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return <SettingsContext.Provider value={{ settings, setSetting }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

// Shows the onboarding pages again; provided by the app root, which owns them
export const ReplayIntroContext = createContext<() => void>(() => {});
export const useReplayIntro = () => useContext(ReplayIntroContext);

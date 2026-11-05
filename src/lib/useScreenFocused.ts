import { useContext, useEffect, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';

// Tab screens stay mounted in the background; pause there so a hidden Ocho
// doesn't eat frames from the screen you're on. Outside navigation
// (onboarding) there's no screen to track, so he's always on.
export function useScreenFocused() {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

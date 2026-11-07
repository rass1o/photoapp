import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

// Tapping the tab you're already on scrolls its screen back to the top
// (for when you've scrolled all the way down a feed or list)
export function useTapTabToTop(scrollToTop: () => void) {
  const navigation = useNavigation();
  const latest = useRef(scrollToTop);
  latest.current = scrollToTop;
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        if (navigation.isFocused()) latest.current();
      }),
    [navigation]
  );
}

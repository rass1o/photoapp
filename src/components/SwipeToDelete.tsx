import { ReactNode, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';

// Swipe a row left to delete it; a short swipe snaps back. Plain React
// Native (no gesture library), so it works without a new native build.

type Props = {
  children: ReactNode;
  onDelete: () => void;
  // lets the list stop scrolling while a row is being swiped
  onSwipingChange?: (swiping: boolean) => void;
  // the row's own background, so the red doesn't show through at rest
  backgroundColor?: string;
};

export default function SwipeToDelete({ children, onDelete, onSwipingChange, backgroundColor = colors.shell }: Props) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  // the responder is made once, so it reads the latest props through this
  const latest = useRef({ width, onDelete, onSwipingChange });
  latest.current = { width, onDelete, onSwipingChange };

  const snapBack = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const responder = useRef(
    PanResponder.create({
      // only clearly sideways drags, so scrolling the list still works
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => latest.current.onSwipingChange?.(true),
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        latest.current.onSwipingChange?.(false);
        const { width: w } = latest.current;
        if (g.dx < -w * 0.3 || (g.dx < -40 && g.vx < -0.8)) {
          Animated.timing(x, { toValue: -w, duration: 180, useNativeDriver: true }).start(() => latest.current.onDelete());
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onSwipingChange?.(false);
        snapBack();
      },
    })
  ).current;

  const behindOpacity = x.interpolate({ inputRange: [-60, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View>
      <Animated.View style={[styles.behind, { opacity: behindOpacity }]} pointerEvents="none">
        <Ionicons name="trash" size={18} color={colors.white} />
        <Text style={styles.behindText}>Delete</Text>
      </Animated.View>
      <Animated.View style={{ backgroundColor, transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  behind: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 18,
  },
  behindText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});

import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from './Themed';
import { colors, fonts } from '../theme';

// The bottom tab bar as a strip of deep sea: a wavy top edge with a lighter
// crest, little bubbles, the active tab glowing in a reef pill, and Submit
// raised in the middle as a coral camera button.

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  Home: { on: 'home', off: 'home-outline' },
  Submit: { on: 'camera', off: 'camera-outline' },
  Rankings: { on: 'trophy', off: 'trophy-outline' },
  Shop: { on: 'storefront', off: 'storefront-outline' },
  Profile: { on: 'person', off: 'person-outline' },
};

const RAISED = 'Submit';
const WAVE_TOP = 12; // room above the bar's body for the wave crests
const BODY = 60; // height of the bar's body, under the waves
const IDLE = '#8FB8CC';

// A wavy line across the top: crests and troughs every quarter of a period
function wavePath(width: number, height: number) {
  const period = width / 3;
  let d = `M0,${WAVE_TOP}`;
  for (let x = 0; x < width; x += period) {
    d += ` Q${x + period / 4},${WAVE_TOP - 9} ${x + period / 2},${WAVE_TOP}`;
    d += ` Q${x + (period * 3) / 4},${WAVE_TOP + 9} ${x + period},${WAVE_TOP}`;
  }
  return { fill: `${d} L${width},${height} L0,${height} Z`, crest: d };
}

export default function SeaTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = WAVE_TOP + BODY + insets.bottom;
  const wave = wavePath(width, height);

  return (
    <View style={[styles.bar, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <LinearGradient id="tabSea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E4F7A" />
            <Stop offset="1" stopColor={colors.ink} />
          </LinearGradient>
        </Defs>
        <Path d={wave.fill} fill="url(#tabSea)" />
        <Path d={wave.crest} stroke={colors.seaDeep} strokeWidth={2.5} strokeOpacity={0.55} fill="none" />
        <Circle cx={width * 0.08} cy={WAVE_TOP + 30} r={3} fill="#FFFFFF" opacity={0.12} />
        <Circle cx={width * 0.32} cy={WAVE_TOP + 44} r={2} fill="#FFFFFF" opacity={0.12} />
        <Circle cx={width * 0.7} cy={WAVE_TOP + 40} r={2.5} fill="#FFFFFF" opacity={0.12} />
        <Circle cx={width * 0.93} cy={WAVE_TOP + 24} r={2} fill="#FFFFFF" opacity={0.12} />
      </Svg>

      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          const icon = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          if (route.name === RAISED) {
            return (
              <Pressable
                key={route.key}
                style={styles.tab}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
              >
                <View style={[styles.raised, focused && styles.raisedFocused]}>
                  <Ionicons name="camera" size={26} color={colors.white} />
                </View>
                <Text style={[styles.label, styles.raisedLabel, focused && styles.labelFocused]}>{label}</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <View style={[styles.pill, focused && styles.pillFocused]}>
                <Ionicons name={focused ? icon.on : icon.off} size={21} color={focused ? colors.white : IDLE} />
                {badge !== undefined && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pulled up over the bottom of the screen so the wave itself is the border
  // (the screen's own sand shows between the crests, no flat strip)
  bar: { position: 'relative', backgroundColor: 'transparent', marginTop: -WAVE_TOP },
  row: { flex: 1, flexDirection: 'row', paddingTop: WAVE_TOP + 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  pill: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillFocused: {
    backgroundColor: colors.reef,
    shadowColor: colors.seaDeep,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: IDLE, marginTop: 2 },
  labelFocused: { color: colors.white },

  // Submit pokes up out of the water
  raised: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -34,
    backgroundColor: colors.coral,
    borderWidth: 4,
    borderColor: colors.shell,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  raisedFocused: { backgroundColor: '#F27A5E', borderColor: colors.seaDeep },
  raisedLabel: { marginTop: 2 },

  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.coral,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 9, color: colors.white },
});

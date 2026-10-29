import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Octopus from './Octopus';
import { Text } from './Themed';
import { useAuth } from '../context/AuthContext';
import { OctopusData, loadOctopus } from '../lib/octopus';
import { colors, bubbly } from '../theme';

type Kind = 'weekly' | 'daily';

type Props = {
  visible: boolean;
  kind: Kind;
  themeName?: string;
  streak?: number;
  reward?: number;
  // Extra shutters from hitting a streak milestone
  bonus?: number;
  onClose: () => void;
};

// {theme} and {streak} are filled in when shown
const PHRASES: Record<Kind, string[]> = {
  weekly: [
    'Shell yeah! Your "{theme}" shot is in. Good luck in the rankings!',
    'Ink-credible catch! Fingers, all eight of them, crossed for a top 5 spot.',
    'That one’s a keeper. May the votes flow in like the tide!',
    'You did it! I’ve got a good feeling about this one. Go get that podium!',
    'Kraken work! Now let’s see how it does in the rankings.',
  ],
  daily: [
    'Daily photo done! That’s {streak} in a row. Keep it rolling!',
    'Snap! {streak} day streak and counting. See you tomorrow!',
    'Another day, another catch. {streak} days strong!',
    'Look at you showing up! {streak} days and the tide’s on your side.',
    'Fin-tastic! One shot a day keeps the rust away. {streak} day streak!',
  ],
};

const BUBBLES = 8;
const OCHO = 150;
// Where the left tentacle tip lands inside the Octopus drawing at this size
const TIP = { x: OCHO * 0.2, y: OCHO * 0.99 };
const BALLOON = { w: 70, h: 170 };

function Balloon() {
  return (
    <Svg width={BALLOON.w} height={BALLOON.h} viewBox={`0 0 ${BALLOON.w} ${BALLOON.h}`}>
      <Path
        d={`M35,68 C30,90 42,110 34,132 C28,148 38,160 35,${BALLOON.h}`}
        stroke={colors.abyss}
        strokeWidth={2}
        fill="none"
      />
      <Ellipse cx={35} cy={36} rx={27} ry={33} fill={colors.coral} stroke={colors.abyss} strokeWidth={3} />
      <Ellipse cx={25} cy={24} rx={6} ry={10} fill={colors.white} opacity={0.45} rotation={-20} origin="25, 24" />
      <Path d="M30,68 L40,68 L35,74 Z" fill={colors.coral} stroke={colors.abyss} strokeWidth={2.5} strokeLinejoin="round" />
    </Svg>
  );
}

// Ocho swims up holding a balloon and a camera to cheer on a fresh submission
export default function OchoCelebration({ visible, kind, themeName, streak, reward, bonus, onClose }: Props) {
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const [octopus, setOctopus] = useState<OctopusData | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const bubbles = useRef(Array.from({ length: BUBBLES }, () => new Animated.Value(0))).current;

  // Pick a fresh line each time it opens
  const phrase = useMemo(() => {
    const options = PHRASES[kind];
    return options[Math.floor(Math.random() * options.length)]
      .replace('{theme}', themeName ?? 'weekly')
      .replace('{streak}', String(streak ?? 1));
  }, [visible, kind, themeName, streak]);

  const bubbleSpots = useMemo(
    () => bubbles.map(() => ({ left: `${8 + Math.random() * 84}%` as const, size: 8 + Math.random() * 14 })),
    []
  );

  useEffect(() => {
    if (visible && user) loadOctopus(user.id).then((o) => setOctopus(o.octopus));
  }, [visible, user]);

  useEffect(() => {
    if (!visible) return;
    [fade, rise, wiggle, pop].forEach((v) => v.setValue(0));

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(rise, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        // A happy little shimmy once he arrives
        Animated.sequence(
          [1, -1, 0.6, -0.6, 0].map((toValue) =>
            Animated.timing(wiggle, { toValue, duration: 120, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          )
        ),
      ]),
      Animated.sequence([
        Animated.delay(450),
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
    ]).start();

    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    swayLoop.start();

    const bubbleLoops = bubbles.map((b, i) => {
      b.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 280),
          Animated.timing(b, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => {
      swayLoop.stop();
      bubbleLoops.forEach((l) => l.stop());
    };
  }, [visible]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] });
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  const balloonRotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        {bubbles.map((b, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.bubble,
              {
                left: bubbleSpots[i].left,
                width: bubbleSpots[i].size,
                height: bubbleSpots[i].size,
                borderRadius: bubbleSpots[i].size / 2,
                opacity: b.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
                transform: [{ translateY: b.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.8] }) }],
              },
            ]}
          />
        ))}

        <Animated.View style={[styles.speech, { opacity: pop, transform: [{ scale: pop }] }]}>
          <Text style={styles.speechTitle}>{kind === 'weekly' ? 'Submitted!' : 'Posted!'}</Text>
          <Text style={styles.speechText}>{phrase}</Text>
          {kind === 'weekly' && streak ? (
            <View style={styles.streakChip}>
              <Ionicons name="trophy" size={14} color="#92400E" />
              <Text style={styles.streakChipText}>{streak} week streak</Text>
            </View>
          ) : null}
          {kind === 'daily' && streak ? (
            <View style={[styles.streakChip, styles.dailyChip]}>
              <Ionicons name="flame" size={14} color={colors.coral} />
              <Text style={[styles.streakChipText, styles.dailyChipText]}>{streak} day streak</Text>
            </View>
          ) : null}
          {bonus ? <Text style={styles.bonus}>Streak bonus! +{bonus} shutters</Text> : null}
          {reward ? <Text style={styles.reward}>{bonus ? `+${reward} shutters total` : `+${reward} shutter`}</Text> : null}
          <View style={styles.speechTail} />
        </Animated.View>

        <Animated.View style={[styles.ochoWrap, { transform: [{ translateY }, { rotate }] }]}>
          <Animated.View
            style={[
              styles.balloon,
              // Swing from the string's end rather than the balloon's middle
              {
                transform: [
                  { translateY: BALLOON.h / 2 },
                  { rotate: balloonRotate },
                  { translateY: -BALLOON.h / 2 },
                ],
              },
            ]}
          >
            <Balloon />
          </Animated.View>
          <Octopus
            color={octopus?.color ?? '#a78bfa'}
            accessory={octopus?.accessory}
            heldItem="camera"
            pet={octopus?.pet}
            size={OCHO}
          />
          <Text style={styles.name}>{octopus?.name ?? 'Ocho'}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: pop }}>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Thanks, {octopus?.name ?? 'Ocho'}!</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bubble: {
    position: 'absolute',
    bottom: -20,
    borderWidth: 1.5,
    borderColor: colors.reefBorder,
    backgroundColor: 'rgba(221, 243, 248, 0.25)',
  },
  speech: {
    backgroundColor: colors.shell,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: colors.abyss,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 14,
  },
  speechTitle: { ...bubbly, fontSize: 24, marginBottom: 4 },
  speechText: { fontSize: 15, color: colors.ink, textAlign: 'center', lineHeight: 21 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakChipText: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  dailyChip: { backgroundColor: '#FFE9DF', borderColor: colors.coral },
  dailyChipText: { color: '#B5391E' },
  bonus: { ...bubbly, fontSize: 18, color: colors.coral, textShadowColor: '#FFD2C2', marginTop: 8 },
  reward: { fontSize: 13, fontWeight: '700', color: colors.coral, marginTop: 8 },
  speechTail: {
    position: 'absolute',
    bottom: -9,
    width: 16,
    height: 16,
    backgroundColor: colors.shell,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.abyss,
    transform: [{ rotate: '45deg' }],
  },
  ochoWrap: { alignItems: 'center', paddingTop: BALLOON.h - TIP.y + 10 },
  balloon: {
    position: 'absolute',
    top: 10,
    left: TIP.x - BALLOON.w / 2,
  },
  name: { ...bubbly, color: colors.white, textShadowColor: colors.abyss, fontSize: 18, marginTop: 2 },
  button: {
    marginTop: 18,
    backgroundColor: colors.reef,
    borderRadius: 22,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.abyss,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});

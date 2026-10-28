import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Themed';
import Clam from './Clam';
import Octopus from './Octopus';
import { ShopItem } from '../lib/shop';
import { BoxOdds, ITEMS_PER_BOX, RARITY_COLORS, Rarity } from '../lib/blindBox';
import { colors, bubbly } from '../theme';

type Props = {
  box: ShopItem | null; // null = closed
  odds: BoxOdds[];
  balance: number;
  octopusColor: string;
  onOpen: () => Promise<ShopItem[]>; // charges and returns what was inside
  onClose: () => void;
  onCustomize: () => void;
};

function formatChance(chance: number) {
  const pct = chance * 100;
  return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1).replace(/\.0$/, '')}%`;
}

function RarityChip({ rarityId, label }: { rarityId: string; label: string }) {
  const c = RARITY_COLORS[rarityId] ?? RARITY_COLORS.common;
  return (
    <View style={[styles.rarityChip, { backgroundColor: c.bg }]}>
      <Text style={[styles.rarityText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

// Bottom sheet for the clam blind box: what could be inside and the odds,
// then the reveal once it's opened.
export default function BlindBoxModal({ box, odds, balance, octopusColor, onOpen, onClose, onCustomize }: Props) {
  const [phase, setPhase] = useState<'info' | 'opening' | 'revealed'>('info');
  const [found, setFound] = useState<Array<{ item: ShopItem; rarity?: Rarity }>>([]);
  const pop = useRef(new Animated.Value(1)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  // Start fresh each time the sheet opens
  useEffect(() => {
    if (box) {
      setPhase('info');
      setFound([]);
    }
  }, [box?.id]);

  const canOpen = odds.length >= ITEMS_PER_BOX;

  const open = async () => {
    if (!box) return;
    if (balance < box.price) {
      Alert.alert(
        'Not enough shutters',
        `You’re ${box.price - balance} short. Don’t clam up: post daily photos and place in weekly themes to earn more.`
      );
      return;
    }

    // Once opened these leave the pool (you own them), so keep their rarity now
    const rarityById = new Map(odds.map((o) => [o.item.id, o.rarity]));
    setPhase('opening');
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 90, useNativeDriver: true }),
      ])
    );
    shake.start();

    try {
      const items = await onOpen();
      shake.stop();
      wiggle.setValue(0);
      setFound(items.map((item) => ({ item, rarity: rarityById.get(item.id) })));
      setPhase('revealed');
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    } catch (err) {
      shake.stop();
      wiggle.setValue(0);
      setPhase('info');
      Alert.alert('The clam stayed shut', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <Modal visible={box !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={phase === 'opening' ? undefined : onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Blind box</Text>
            <Text style={styles.title}>{box?.label ?? ''}</Text>
          </View>
          {phase !== 'opening' && (
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.clamWrap, { transform: [{ rotate }, { scale: pop }] }]}>
            <Clam size={130} open={phase === 'revealed'} />
          </Animated.View>

          {phase === 'revealed' ? (
            <>
              <Text style={styles.revealTitle}>Shell yeah! You found:</Text>
              <View style={styles.foundRow}>
                {found.map(({ item, rarity }) => (
                  <View key={item.id} style={styles.foundCard}>
                    <Octopus color={octopusColor} accessory={item.value} size={84} />
                    <Text style={styles.foundLabel}>{item.label}</Text>
                    {rarity && <RarityChip rarityId={rarity.id} label={rarity.label} />}
                  </View>
                ))}
              </View>
              <Text style={styles.note}>They{'’'}re in your collection now. Put one on Ocho!</Text>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Crack it open for {ITEMS_PER_BOX} random accessories for your octopus. You only get ones you
                don{'’'}t own yet, so never a duplicate.
              </Text>

              <Text style={styles.sectionLabel}>What{'’'}s inside · your chances</Text>
              {canOpen ? (
                <View style={styles.oddsList}>
                  {odds.map(({ item, rarity, chance }) => (
                    <View key={item.id} style={styles.oddsRow}>
                      <View style={styles.oddsOcto}>
                        <Octopus color={octopusColor} accessory={item.value} size={40} animated={false} />
                      </View>
                      <Text style={styles.oddsLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <RarityChip rarityId={rarity.id} label={rarity.label} />
                      <Text style={styles.oddsChance}>{formatChance(chance)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  You{'’'}ve collected almost every accessory in this clam.
                  {odds.length === 1 ? ` The last one, ${odds[0].item.label}, is in the Shop.` : ''} More are
                  washing ashore soon.
                </Text>
              )}
              {canOpen && (
                <Text style={styles.note}>
                  Each percentage is the chance that accessory is one of your {ITEMS_PER_BOX}, out of the{' '}
                  {odds.length} you don{'’'}t own yet. Rarer finds are on the way.
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {phase === 'revealed' ? (
          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={styles.secondaryText}>Done</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={onCustomize}>
              <Ionicons name="color-wand-outline" size={16} color={colors.white} />
              <Text style={styles.primaryText}>Dress up Ocho</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.button, styles.primaryButton, styles.openButton, (!canOpen || phase === 'opening') && styles.disabled]}
            onPress={open}
            disabled={!canOpen || phase === 'opening'}
          >
            {phase === 'opening' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryText}>Open the clam</Text>
                <Ionicons name="flash" size={13} color={colors.white} />
                <Text style={styles.primaryText}>{box?.price}</Text>
              </>
            )}
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sandDark,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  title: { ...bubbly, fontSize: 22 },
  content: { paddingBottom: 12 },
  clamWrap: { alignSelf: 'center', marginVertical: 8 },
  description: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  oddsList: { gap: 6 },
  oddsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.sand,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  oddsOcto: { width: 40, height: 50, alignItems: 'center', justifyContent: 'center' },
  oddsLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  oddsChance: { width: 48, textAlign: 'right', fontSize: 14, fontWeight: '700', color: colors.deep },
  rarityChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  rarityText: { fontSize: 11, fontWeight: '600' },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 12 },

  revealTitle: { ...bubbly, fontSize: 22, textAlign: 'center', marginBottom: 12 },
  foundRow: { flexDirection: 'row', gap: 10 },
  foundCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.sandBorder,
  },
  foundLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },

  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22,
    paddingVertical: 13,
  },
  openButton: { flex: 0, marginTop: 4, marginBottom: 8 },
  primaryButton: { backgroundColor: colors.deep },
  primaryText: { fontSize: 15, fontWeight: '600', color: colors.white },
  secondaryButton: { borderWidth: 1.5, borderColor: colors.sandBorder },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  disabled: { opacity: 0.5 },
});

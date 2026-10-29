import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Themed';
import Clam from './Clam';
import Octopus from './Octopus';
import Sidekick from './Sidekick';
import { ShopItem } from '../lib/shop';
import { Duplicate, ITEMS_PER_BOX, Pick, RARITY_COLORS, TierOdds, sellValue } from '../lib/blindBox';
import { colors, bubbly } from '../theme';

type Props = {
  box: ShopItem | null; // null = closed
  tiers: TierOdds[];
  ownedIds: Set<string>;
  duplicates: Duplicate[]; // unsold, from earlier clams
  balance: number;
  octopusColor: string;
  onOpen: () => Promise<Pick[]>; // charges and returns what was inside
  onSell: (duplicateId: string) => Promise<number>; // returns the refund
  onClose: () => void;
  onCustomize: () => void;
};

const SPARKS = 10;

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

const rarityLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

// What an item looks like on your octopus (or beside it, for pets)
export function ItemPreview({ item, color, size }: { item: ShopItem; color: string; size: number }) {
  if (item.category === 'octo_pet') return <Sidekick kind={item.value} size={size * 0.9} />;
  return (
    <Octopus
      color={color}
      accessory={item.category === 'octo_accessory' ? item.value : null}
      heldItem={item.category === 'octo_item' ? item.value : null}
      size={size}
      animated={false}
    />
  );
}

// Bottom sheet for the clam blind box: the odds by rarity, then a shake,
// a burst and the reveal, with duplicates you can sell back for half price.
export default function BlindBoxModal({
  box,
  tiers,
  ownedIds,
  duplicates,
  balance,
  octopusColor,
  onOpen,
  onSell,
  onClose,
  onCustomize,
}: Props) {
  const [phase, setPhase] = useState<'info' | 'opening' | 'revealed'>('info');
  const [found, setFound] = useState<Pick[]>([]);
  const [sold, setSold] = useState<Record<string, number>>({}); // duplicateId -> refund
  const [sellingId, setSellingId] = useState<string | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const swell = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const sparkAngles = useRef(Array.from({ length: SPARKS }, (_, i) => (i / SPARKS) * Math.PI * 2)).current;

  // Start fresh each time the sheet opens
  useEffect(() => {
    if (box) {
      setPhase('info');
      setFound([]);
      setSold({});
      [shake, burst, reveal].forEach((v) => v.setValue(0));
      swell.setValue(1);
    }
  }, [box?.id]);

  const canOpen = tiers.length > 0;

  // Rattles harder and harder while the clam swells, about 1.6s
  const rattle = () => {
    const amps = [0.3, -0.3, 0.45, -0.45, 0.6, -0.6, 0.75, -0.75, 0.9, -0.9, 1, -1, 1, -1, 0];
    return Animated.parallel([
      Animated.sequence(
        amps.map((toValue, i) =>
          Animated.timing(shake, { toValue, duration: i < 4 ? 140 : 90, useNativeDriver: true })
        )
      ),
      Animated.timing(swell, { toValue: 1.15, duration: 1500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
  };

  const open = async () => {
    if (!box) return;
    if (balance < box.price) {
      Alert.alert(
        'Not enough shutters',
        `You’re ${box.price - balance} short. Don’t clam up: post daily photos and place in weekly themes to earn more.`
      );
      return;
    }

    setPhase('opening');
    const shaking = new Promise<void>((resolve) => rattle().start(() => resolve()));

    try {
      const [picks] = await Promise.all([onOpen(), shaking]);
      setFound(picks);
      setPhase('revealed');
      burst.setValue(0);
      reveal.setValue(0);
      swell.setValue(0.7);
      Animated.parallel([
        Animated.spring(swell, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(250),
          Animated.spring(reveal, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]),
      ]).start();
    } catch (err) {
      await shaking;
      shake.setValue(0);
      swell.setValue(1);
      setPhase('info');
      Alert.alert('The clam stayed shut', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const sell = async (duplicateId: string) => {
    setSellingId(duplicateId);
    try {
      const refund = await onSell(duplicateId);
      setSold((s) => ({ ...s, [duplicateId]: refund }));
    } catch (err) {
      Alert.alert('Couldn’t sell that', err instanceof Error ? err.message : 'Please try again.');
    }
    setSellingId(null);
  };

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  const gotLegendary = found.some((p) => p.item.rarity === 'legendary');
  // Duplicates from earlier clams (this clam's show on their own cards)
  const leftovers = duplicates.filter((d) => !found.some((p) => p.duplicateId === d.id) && !(d.id in sold));

  const SellButton = ({ duplicateId, item }: { duplicateId: string; item: ShopItem }) =>
    duplicateId in sold ? (
      <View style={[styles.sellButton, styles.soldButton]}>
        <Ionicons name="checkmark" size={13} color="#047857" />
        <Text style={styles.soldText}>Sold +{sold[duplicateId]}</Text>
      </View>
    ) : (
      <Pressable style={styles.sellButton} onPress={() => sell(duplicateId)} disabled={sellingId !== null}>
        {sellingId === duplicateId ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Text style={styles.sellText}>Sell</Text>
            <Ionicons name="flash" size={11} color={colors.white} />
            <Text style={styles.sellText}>{sellValue(item)}</Text>
          </>
        )}
      </Pressable>
    );

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
          <View style={styles.stage}>
            {phase === 'revealed' &&
              sparkAngles.map((angle, i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.spark,
                    gotLegendary && styles.sparkGold,
                    {
                      opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 110] }) },
                        { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 80] }) },
                        { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) },
                      ],
                    },
                  ]}
                />
              ))}
            {phase === 'revealed' && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.flash,
                  {
                    opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.9, 0.6, 0] }),
                    transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
                  },
                ]}
              />
            )}
            <Animated.View style={{ transform: [{ rotate }, { scale: swell }] }}>
              <Clam size={130} open={phase === 'revealed'} />
            </Animated.View>
          </View>

          {phase === 'opening' && <Text style={styles.openingText}>Something{'’'}s rattling in there…</Text>}

          {phase === 'revealed' && (
            <Animated.View
              style={{
                opacity: reveal,
                transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              }}
            >
              <Text style={styles.revealTitle}>{gotLegendary ? 'LEGENDARY find!' : 'Shell yeah! You found:'}</Text>
              <View style={styles.foundRow}>
                {found.map(({ item, duplicateId }, i) => {
                  const legendary = item.rarity === 'legendary';
                  return (
                    <View key={`${item.id}-${i}`} style={[styles.foundCard, legendary && styles.foundCardLegendary]}>
                      <View style={[styles.newTag, duplicateId && styles.dupTag]}>
                        <Text style={[styles.newTagText, duplicateId && styles.dupTagText]}>
                          {duplicateId ? 'Duplicate' : 'New!'}
                        </Text>
                      </View>
                      <View style={styles.foundArt}>
                        <ItemPreview item={item} color={octopusColor} size={84} />
                      </View>
                      <Text style={styles.foundLabel}>{item.label}</Text>
                      <RarityChip rarityId={item.rarity} label={rarityLabel(item.rarity)} />
                      {duplicateId ? (
                        <SellButton duplicateId={duplicateId} item={item} />
                      ) : (
                        <Text style={styles.addedText}>Added to your collection</Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {found.some((p) => p.duplicateId && !(p.duplicateId in sold)) && (
                <Text style={styles.note}>
                  Already had it? Sell duplicates for half their price, now or later from the clam.
                </Text>
              )}
            </Animated.View>
          )}

          {phase === 'info' && (
            <>
              <Text style={styles.description}>
                Crack it open for {ITEMS_PER_BOX} surprises for your octopus: hats, gear and, if the tide{'’'}s
                with you, a legendary sidekick. Pull something you already have? Sell it back for half its price.
              </Text>

              <Text style={styles.sectionLabel}>Chances for each pull</Text>
              {canOpen ? (
                <View style={styles.oddsList}>
                  {tiers.map(({ rarity, chance, items }) => (
                    <View
                      key={rarity.id}
                      style={[styles.tierCard, { borderColor: (RARITY_COLORS[rarity.id] ?? RARITY_COLORS.common).fg }]}
                    >
                      <View style={styles.tierHeader}>
                        <RarityChip rarityId={rarity.id} label={rarity.label} />
                        <Text style={styles.tierItems}>
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </Text>
                        <Text style={styles.tierChance}>{formatChance(chance)}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierRow}>
                        {items.map((item) => (
                          <View key={item.id} style={styles.tierItem}>
                            <View style={styles.tierArt}>
                              <ItemPreview item={item} color={octopusColor} size={40} />
                            </View>
                            <Text style={styles.tierLabel} numberOfLines={1}>
                              {item.label}
                            </Text>
                            {ownedIds.has(item.id) && (
                              <View style={styles.ownedDot}>
                                <Ionicons name="checkmark" size={9} color={colors.white} />
                              </View>
                            )}
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>This clam is empty right now. Check back soon.</Text>
              )}
              <Text style={styles.note}>
                Each pull picks a rarity first, then an item in it at random. A check means you already own it,
                so pulling it again gives a duplicate to sell.
              </Text>
            </>
          )}

          {phase !== 'opening' && leftovers.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Duplicates to sell</Text>
              <View style={styles.oddsList}>
                {leftovers.map((d) => (
                  <View key={d.id} style={styles.dupRow}>
                    <View style={styles.tierArt}>
                      <ItemPreview item={d.item} color={octopusColor} size={40} />
                    </View>
                    <Text style={styles.dupLabel} numberOfLines={1}>
                      {d.item.label}
                    </Text>
                    <SellButton duplicateId={d.id} item={d.item} />
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {phase === 'revealed' ? (
          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => setPhase('info')}>
              <Text style={styles.secondaryText}>Open another</Text>
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
    maxHeight: '90%',
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

  stage: { height: 150, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  flash: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF7D6' },
  spark: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.seaDeep },
  sparkGold: { backgroundColor: '#FBBF24' },
  openingText: { textAlign: 'center', color: colors.muted, fontSize: 14, marginBottom: 8 },

  description: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  oddsList: { gap: 8 },
  tierCard: { backgroundColor: colors.sand, borderRadius: 12, borderWidth: 1.5, padding: 10 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tierItems: { flex: 1, fontSize: 12, color: colors.muted },
  tierChance: { fontSize: 18, fontWeight: '700', color: colors.deep },
  tierRow: { gap: 8 },
  tierItem: { width: 62, alignItems: 'center' },
  tierArt: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  tierLabel: { fontSize: 11, color: colors.text, textAlign: 'center' },
  ownedDot: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rarityChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  rarityText: { fontSize: 11, fontWeight: '700' },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 12 },

  revealTitle: { ...bubbly, fontSize: 24, textAlign: 'center', marginBottom: 12 },
  foundRow: { flexDirection: 'row', gap: 10 },
  foundCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderRadius: 14,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.sandBorder,
  },
  foundCardLegendary: { backgroundColor: '#FDF1C7', borderColor: '#D4A017', borderWidth: 3 },
  foundArt: { height: 105, justifyContent: 'center' },
  foundLabel: { fontSize: 15, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  newTag: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  newTagText: { fontSize: 11, fontWeight: '700', color: colors.white },
  dupTag: { backgroundColor: colors.sandDark },
  dupTagText: { color: colors.ink },
  addedText: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  sellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 84,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.coral,
  },
  sellText: { fontSize: 12, fontWeight: '700', color: colors.white },
  soldButton: { backgroundColor: '#ecfdf5' },
  soldText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  dupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.sand,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dupLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },

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

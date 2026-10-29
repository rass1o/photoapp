import { ReactNode } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { colors } from '../theme';
import { RARITY_COLORS } from '../lib/blindBox';

// equipped/owned: equippable item you have; collected: owned but not
// equippable (e.g. stamps, picked per photo); buy: for sale; locked: earned only
export type TileStatus = 'equipped' | 'owned' | 'collected' | 'buy' | 'locked';

type Props = {
  label: string;
  swatch: ReactNode;
  status: TileStatus;
  price?: number;
  hint?: string | null;
  selected?: boolean;
  busy?: boolean;
  wide?: boolean; // full-width row instead of a grid tile, for long labels
  rarity?: string; // shows a rarity chip, for octopus gear
  onPress?: () => void;
  onEquip?: () => void;
  onBuy?: () => void;
};

// One grid tile used by the Shop and the octopus customizer
export default function ShopTile({ label, swatch, status, price, hint, selected, busy, wide, rarity, onPress, onEquip, onBuy }: Props) {
  const renderAction = () => {
    if (busy) return <ActivityIndicator style={styles.spinner} color={colors.deep} />;

    switch (status) {
      case 'equipped':
        return (
          <View style={[styles.action, styles.equipped]}>
            <Ionicons name="checkmark" size={12} color="#047857" />
            <Text style={styles.equippedText}>Equipped</Text>
          </View>
        );
      case 'collected':
        return (
          <View style={[styles.action, styles.equipped]}>
            <Ionicons name="checkmark" size={12} color="#047857" />
            <Text style={styles.equippedText}>Owned</Text>
          </View>
        );
      case 'owned':
        return (
          <Pressable style={[styles.action, styles.equip]} onPress={onEquip}>
            <Text style={styles.equipText}>Equip</Text>
          </Pressable>
        );
      case 'locked':
        return (
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed" size={11} color={colors.faint} />
            <Text style={styles.lockedText} numberOfLines={2}>
              {hint ?? 'Earned only'}
            </Text>
          </View>
        );
      case 'buy':
        return (
          <Pressable style={[styles.action, styles.buy]} onPress={onBuy}>
            <Ionicons name="flash" size={11} color={colors.white} />
            <Text style={styles.buyText}>{price}</Text>
          </Pressable>
        );
    }
  };

  return (
    <Pressable
      style={[styles.tile, wide && styles.tileWide, selected && styles.tileSelected]}
      onPress={onPress}
    >
      {swatch}
      <Text style={[styles.label, wide && styles.labelWide, rarity && styles.labelWithRarity]} numberOfLines={wide ? 2 : 1}>
        {label}
      </Text>
      {rarity && (
        <View style={[styles.rarity, { backgroundColor: (RARITY_COLORS[rarity] ?? RARITY_COLORS.common).bg }]}>
          <Text style={[styles.rarityText, { color: (RARITY_COLORS[rarity] ?? RARITY_COLORS.common).fg }]}>
            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
          </Text>
        </View>
      )}
      <View style={wide ? styles.actionWide : styles.actionSlot}>{renderAction()}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31.5%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.sandBorder,
  },
  tileWide: { width: '100%', flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  tileSelected: { borderColor: colors.deep, backgroundColor: colors.sandLight },
  label: { fontSize: 12, color: colors.text, fontWeight: '500', marginTop: 6, marginBottom: 6 },
  labelWithRarity: { marginBottom: 3 },
  rarity: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 6 },
  rarityText: { fontSize: 10, fontWeight: '700' },
  labelWide: { flex: 1, fontSize: 13, marginTop: 0, marginBottom: 0 },
  actionSlot: { alignSelf: 'stretch', alignItems: 'center' },
  actionWide: { width: 92, alignItems: 'center' },

  spinner: { height: 24 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 24,
    alignSelf: 'stretch',
    borderRadius: 6,
  },
  buy: { backgroundColor: colors.deep },
  buyText: { fontSize: 12, color: colors.white, fontWeight: '600' },
  equip: { borderWidth: 1, borderColor: colors.reefBorder, backgroundColor: colors.reefLight },
  equipText: { fontSize: 12, color: colors.reef, fontWeight: '600' },
  equipped: { backgroundColor: '#ecfdf5' },
  equippedText: { fontSize: 12, color: '#047857', fontWeight: '600' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 24 },
  lockedText: { flexShrink: 1, fontSize: 10, color: colors.faint, textAlign: 'center' },
});

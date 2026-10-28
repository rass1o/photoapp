import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileCategory, ShopItem } from '../lib/shop';
import ShopTile from './ShopTile';
import CosmeticSwatch from './CosmeticSwatch';
import { Text } from './Themed';
import { colors } from '../theme';

const TITLES: Record<ProfileCategory, string> = {
  frame: 'Avatar frames',
  banner: 'Banners',
  badge: 'Badges',
};

type Props = {
  category: ProfileCategory | null; // null = closed
  ownedItems: ShopItem[]; // already filtered to this category and owned
  equippedValue: string | null;
  onEquip: (item: ShopItem) => void;
  onClose: () => void;
  onOpenShop: () => void;
};

// Bottom sheet listing everything you own in one category, tap to wear it
export default function LockerModal({ category, ownedItems, equippedValue, onEquip, onClose, onOpenShop }: Props) {
  return (
    <Modal visible={category !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Your locker</Text>
            <Text style={styles.title}>{category ? TITLES[category] : ''}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {category &&
            ownedItems.map((item) => {
              const equipped = item.value === equippedValue;
              return (
                <ShopTile
                  key={item.id}
                  label={item.label}
                  swatch={<CosmeticSwatch category={category} value={item.value} />}
                  status={equipped ? 'equipped' : 'owned'}
                  selected={equipped}
                  onPress={() => onEquip(item)}
                  onEquip={() => onEquip(item)}
                />
              );
            })}
        </ScrollView>

        <Text style={styles.hint}>
          {ownedItems.length <= 1
            ? 'Your locker’s looking a little shallow.'
            : 'Tap anything to wear it.'}
        </Text>
        <Pressable style={styles.shopButton} onPress={onOpenShop}>
          <Ionicons name="storefront-outline" size={16} color={colors.white} />
          <Text style={styles.shopButtonText}>Find more in the Shop</Text>
        </Pressable>
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
    maxHeight: '75%',
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
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: colors.deep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 10 },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  shopButtonText: { fontSize: 14, color: colors.white, fontWeight: '600' },
});

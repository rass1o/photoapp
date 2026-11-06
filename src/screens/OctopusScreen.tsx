import { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  LayoutAnimation,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { OctoCategory, ShopItem, isOwned, loadShop, confirmPurchase } from '../lib/shop';
import { OctopusData, OCTO_COLUMN, DEFAULT_LINE } from '../lib/octopus';
import Octopus, { OctopusCard } from '../components/Octopus';
import ShopTile, { TileStatus } from '../components/ShopTile';
import Sidekick from '../components/Sidekick';
import BackBar from '../components/BackBar';
import { Text, TextInput } from '../components/Themed';
import { colors } from '../theme';
import OchoRoom from '../components/OchoRoom';
import OchoLoader from '../components/OchoLoader';

const SECTIONS: Array<{ category: OctoCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { category: 'octo_color', label: 'Colors', icon: 'color-palette-outline' },
  { category: 'octo_accessory', label: 'Accessories', icon: 'glasses-outline' },
  { category: 'octo_item', label: 'Items', icon: 'cube-outline' },
  { category: 'octo_pet', label: 'Sidekicks', icon: 'paw-outline' },
  { category: 'octo_dialogue', label: 'Dialogue', icon: 'chatbubble-ellipses-outline' },
];

// Accessories and items can be taken off, so they get a "None" option
const REMOVABLE: OctoCategory[] = ['octo_accessory', 'octo_item', 'octo_pet'];

export default function OctopusScreen() {
  const { user } = useAuth();
  const [octopus, setOctopus] = useState<OctopusData | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Tapping a tile previews it; undefined = not previewing that slot, null = previewing "None"
  const [preview, setPreview] = useState<Partial<Record<OctoCategory, string | null>>>({});
  // Which closet drawers are pulled open
  const [openDrawers, setOpenDrawers] = useState<Set<OctoCategory>>(() => new Set(['octo_color']));
  const { height: windowHeight } = useWindowDimensions();

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: octoData }, { data: profileData }, shop] = await Promise.all([
      supabase
        .from('octopuses')
        .select('user_id, name, color, accessory, held_item, pet, dialogue')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('profiles').select('currency_balance').eq('id', user.id).single(),
      loadShop(user.id),
    ]);
    setOctopus(octoData);
    setBalance(profileData?.currency_balance ?? 0);
    setItems(shop.items);
    setOwnedIds(shop.ownedIds);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const updateOctopus = async (changes: Partial<OctopusData>) => {
    if (!user || !octopus) return false;
    const previous = octopus;
    setOctopus({ ...octopus, ...changes });
    const { error } = await supabase.from('octopuses').update(changes).eq('user_id', user.id);
    if (error) {
      setOctopus(previous);
      Alert.alert('Couldn’t save that', error.message);
      return false;
    }
    return true;
  };

  const equip = (category: OctoCategory, value: string | null) => {
    setPreview((p) => {
      const next = { ...p };
      delete next[category];
      return next;
    });
    updateOctopus({ [OCTO_COLUMN[category]]: value });
  };

  const buy = (item: ShopItem) => {
    confirmPurchase(
      item,
      balance,
      (newBalance) => {
        setBalance(newBalance);
        setOwnedIds((prev) => new Set(prev).add(item.id));
        equip(item.category as OctoCategory, item.value);
      },
      (busy) => setBusyItemId(busy ? item.id : null)
    );
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (name.length < 1 || name.length > 20) {
      Alert.alert('Pick another name', 'Names need to be 1–20 characters.');
      return;
    }
    if (await updateOctopus({ name })) setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <BackBar title="Your octopus" />
        <View style={[styles.screen, styles.centered]}>
          <OchoLoader message="Ocho is getting dressed…" />
        </View>
      </SafeAreaView>
    );
  }

  if (!octopus) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <BackBar title="Your octopus" />
        <View style={[styles.screen, styles.centered]}>
          <Text style={styles.emptyText}>Your octopus hasn{'’'}t hatched yet. Try again in a moment.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shownValue = (category: OctoCategory) =>
    category in preview ? preview[category] ?? null : octopus[OCTO_COLUMN[category]];

  const shownLineValue = shownValue('octo_dialogue');
  const shownLine =
    items.find((i) => i.category === 'octo_dialogue' && i.value === shownLineValue)?.label ?? DEFAULT_LINE;

  const statusFor = (item: ShopItem): TileStatus => {
    if (octopus[OCTO_COLUMN[item.category as OctoCategory]] === item.value) return 'equipped';
    if (isOwned(item, ownedIds)) return 'owned';
    return item.is_purchasable ? 'buy' : 'locked';
  };

  const renderSwatch = (category: OctoCategory, value: string | null) => {
    switch (category) {
      case 'octo_color':
        return <View style={[styles.colorSwatch, { backgroundColor: value ?? '#a78bfa' }]} />;
      case 'octo_accessory':
        return <Octopus color={octopus.color} accessory={value} size={54} animated={false} />;
      case 'octo_item':
        return <Octopus color={octopus.color} heldItem={value} size={54} animated={false} />;
      case 'octo_pet':
        return value ? <Sidekick kind={value} size={52} /> : <Ionicons name="paw-outline" size={26} color={colors.faint} />;
      case 'octo_dialogue':
        return <Ionicons name="chatbubble-outline" size={18} color={colors.muted} />;
    }
  };

  const toggleDrawer = (category: OctoCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setOpenDrawers((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // The room stays put up top; only the closet below scrolls, so you can try
  // things on and watch Ocho at the same time
  const roomHeight = Math.min(320, Math.max(250, windowHeight * 0.36));
  const ochoSize = Math.min(130, (roomHeight - 96) / 1.25);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar title="Your octopus" />
      <OchoRoom height={roomHeight}>
        <View style={[styles.ochoSpot, { paddingBottom: roomHeight * 0.05 }]}>
          <OctopusCard
            plain
            name={octopus.name}
            line={shownLine}
            color={shownValue('octo_color') ?? octopus.color}
            accessory={shownValue('octo_accessory')}
            heldItem={shownValue('octo_item')}
            pet={shownValue('octo_pet')}
            size={ochoSize}
          />
        </View>
        <View style={styles.balancePill}>
          <Ionicons name="flash" size={13} color="#92400e" />
          <Text style={styles.balanceText}>{balance} shutters</Text>
        </View>
        {Object.keys(preview).length > 0 && (
          <Pressable style={styles.resetPill} onPress={() => setPreview({})}>
            <Ionicons name="eye-outline" size={13} color={colors.deep} />
            <Text style={styles.resetText}>Previewing · tap to reset</Text>
          </Pressable>
        )}
      </OchoRoom>

      <View style={styles.closet}>
        <View style={styles.closetCrown}>
          <Ionicons name="shirt-outline" size={14} color={WOOD.label} />
          <Text style={styles.closetTitle}>{octopus.name}{'\u2019'}s closet</Text>
        </View>
        <View style={styles.rail} />

        <ScrollView contentContainerStyle={styles.closetContent} showsVerticalScrollIndicator={false}>
          {isEditingName ? (
            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                maxLength={20}
                placeholder="Name your octopus"
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <Pressable onPress={saveName} style={styles.nameSaveButton}>
                <Ionicons name="checkmark" size={18} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.nameTag}
              onPress={() => {
                setDraftName(octopus.name);
                setIsEditingName(true);
              }}
            >
              <Ionicons name="pricetag" size={15} color={WOOD.dark} />
              <Text style={styles.nameText}>{octopus.name}</Text>
              <Text style={styles.nameHint}>Rename</Text>
              <Ionicons name="create-outline" size={15} color={colors.reef} />
            </Pressable>
          )}

          {SECTIONS.map((section) => {
            const sectionItems = items.filter((i) => i.category === section.category);
            const isDialogue = section.category === 'octo_dialogue';
            const equippedValue = octopus[OCTO_COLUMN[section.category]];
            const isOpen = openDrawers.has(section.category);
            const ownedCount = sectionItems.filter((i) => isOwned(i, ownedIds)).length;

            return (
              <View key={section.category} style={styles.drawer}>
                <Pressable
                  style={({ pressed }) => [styles.drawerFront, isOpen && styles.drawerFrontOpen, pressed && styles.drawerPressed]}
                  onPress={() => toggleDrawer(section.category)}
                >
                  <Ionicons name={section.icon} size={17} color={WOOD.label} />
                  <Text style={styles.drawerLabel}>{section.label}</Text>
                  <Text style={styles.drawerCount}>
                    {ownedCount}/{sectionItems.length}
                  </Text>
                  <View style={styles.knob}>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={12} color={WOOD.dark} />
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={[styles.drawerInside, isDialogue ? styles.list : styles.grid]}>
                    {REMOVABLE.includes(section.category) && (
                      <ShopTile
                        label="None"
                        swatch={renderSwatch(section.category, null)}
                        status={equippedValue === null ? 'equipped' : 'owned'}
                        selected={section.category in preview && preview[section.category] === null}
                        onPress={() => setPreview((p) => ({ ...p, [section.category]: null }))}
                        onEquip={() => equip(section.category, null)}
                      />
                    )}
                    {sectionItems.map((item) => {
                      const status = statusFor(item);
                      return (
                        <ShopTile
                          key={item.id}
                          wide={isDialogue}
                          label={isDialogue ? item.label.replace('{name}', octopus.name) : item.label}
                          swatch={renderSwatch(section.category, item.value)}
                          status={status}
                          price={item.price}
                          hint={item.unlock_hint}
                          rarity={item.in_blind_box ? item.rarity : undefined}
                          busy={busyItemId === item.id}
                          selected={preview[section.category] === item.value}
                          onPress={() => setPreview((p) => ({ ...p, [section.category]: item.value }))}
                          onEquip={() => equip(section.category, item.value)}
                          onBuy={() => buy(item)}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Closet woods, darkest to lightest
const WOOD = {
  frame: '#6E4325',
  back: '#8A5A36',
  front: '#B07A4C',
  frontTop: '#C9956A',
  dark: '#4A2C17',
  label: '#FFF3DC',
  inside: '#F7E9CF',
  knob: '#E8C26A',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  ochoSpot: { alignItems: 'center' },
  balancePill: {
    position: 'absolute',
    top: 44,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balanceText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  resetPill: {
    position: 'absolute',
    top: 44,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.reefLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resetText: { fontSize: 11, color: colors.deep, fontWeight: '600' },

  closet: { flex: 1, backgroundColor: WOOD.back, borderTopWidth: 4, borderTopColor: WOOD.frame },
  closetCrown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: WOOD.frame,
    paddingVertical: 6,
  },
  closetTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: WOOD.label, textTransform: 'uppercase' },
  // the hanging rail along the top of the closet
  rail: {
    height: 5,
    marginHorizontal: 14,
    marginTop: 6,
    borderRadius: 3,
    backgroundColor: '#D7DEE6',
    borderBottomWidth: 1,
    borderBottomColor: '#94A3B8',
  },
  closetContent: { padding: 12, paddingBottom: 28 },

  nameRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nameInput: {
    flex: 1,
    backgroundColor: WOOD.inside,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  nameSaveButton: {
    backgroundColor: colors.deep,
    borderRadius: 8,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: WOOD.inside,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  nameText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  nameHint: { fontSize: 12, color: colors.reef, fontWeight: '600' },

  // each category is a drawer: a wooden front you tap, and the inside below
  drawer: { marginBottom: 10 },
  drawerFront: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WOOD.front,
    borderRadius: 8,
    borderWidth: 2,
    borderTopColor: WOOD.frontTop,
    borderLeftColor: WOOD.frontTop,
    borderRightColor: WOOD.dark,
    borderBottomColor: WOOD.dark,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  drawerFrontOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  drawerPressed: { opacity: 0.85 },
  drawerLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: WOOD.label },
  drawerCount: { fontSize: 12, fontWeight: '600', color: '#F5DDB8' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WOOD.knob,
    borderWidth: 2,
    borderColor: WOOD.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerInside: {
    backgroundColor: WOOD.inside,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 10,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.abyss },
});

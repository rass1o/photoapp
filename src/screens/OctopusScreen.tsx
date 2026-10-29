import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { OctoCategory, ShopItem, isOwned, loadShop, confirmPurchase } from '../lib/shop';
import { OctopusData, OCTO_COLUMN, DEFAULT_LINE } from '../lib/octopus';
import Octopus, { OctopusCard } from '../components/Octopus';
import ShopTile, { TileStatus } from '../components/ShopTile';
import SectionHeader from '../components/SectionHeader';
import BackBar from '../components/BackBar';
import { Text, TextInput } from '../components/Themed';
import { colors } from '../theme';
import Wave, { WAVE_HEIGHT } from '../components/Wave';
import SandGrain from '../components/SandGrain';

const SECTIONS: Array<{ category: OctoCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { category: 'octo_color', label: 'Colors', icon: 'color-palette-outline' },
  { category: 'octo_accessory', label: 'Accessories', icon: 'glasses-outline' },
  { category: 'octo_item', label: 'Items', icon: 'cube-outline' },
  { category: 'octo_dialogue', label: 'Dialogue', icon: 'chatbubble-ellipses-outline' },
];

// Accessories and items can be taken off, so they get a "None" option
const REMOVABLE: OctoCategory[] = ['octo_accessory', 'octo_item'];

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

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: octoData }, { data: profileData }, shop] = await Promise.all([
      supabase
        .from('octopuses')
        .select('user_id, name, color, accessory, held_item, dialogue')
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
          <ActivityIndicator color={colors.deep} />
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
      case 'octo_dialogue':
        return <Ionicons name="chatbubble-outline" size={18} color={colors.muted} />;
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar title="Your octopus" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.balancePill}>
            <Ionicons name="flash" size={13} color="#92400e" />
            <Text style={styles.balanceText}>{balance} shutters</Text>
          </View>

          <OctopusCard
            name={octopus.name}
            line={shownLine}
            color={shownValue('octo_color') ?? octopus.color}
            accessory={shownValue('octo_accessory')}
            heldItem={shownValue('octo_item')}
            size={150}
          />

          {Object.keys(preview).length > 0 && (
            <Pressable onPress={() => setPreview({})}>
              <Text style={styles.resetPreview}>Previewing · tap to reset</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.sheet}>
          <SandGrain />
          <Wave />
          <SectionHeader icon="pricetag-outline" label="Name" />
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
              style={styles.nameDisplay}
              onPress={() => {
                setDraftName(octopus.name);
                setIsEditingName(true);
              }}
            >
              <Text style={styles.nameText}>{octopus.name}</Text>
              <Ionicons name="create-outline" size={16} color={colors.reef} />
            </Pressable>
          )}

          {SECTIONS.map((section) => {
            const sectionItems = items.filter((i) => i.category === section.category);
            const isDialogue = section.category === 'octo_dialogue';
            const equippedValue = octopus[OCTO_COLUMN[section.category]];

            return (
              <View key={section.category}>
                <SectionHeader icon={section.icon} label={section.label} />
                <View style={isDialogue ? styles.list : styles.grid}>
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
                        busy={busyItemId === item.id}
                        selected={preview[section.category] === item.value}
                        onPress={() => setPreview((p) => ({ ...p, [section.category]: item.value }))}
                        onEquip={() => equip(section.category, item.value)}
                        onBuy={() => buy(item)}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  balanceText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  resetPreview: { fontSize: 11, color: colors.muted, marginTop: 8 },

  sheet: {
    backgroundColor: colors.shell,
    paddingHorizontal: 16,
    paddingTop: WAVE_HEIGHT + 6,
    minHeight: 400,
  },

  nameRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  nameInput: {
    flex: 1,
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
  nameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  nameText: { fontSize: 14, fontWeight: '600', color: colors.ink },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  list: { gap: 8, marginBottom: 18 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.abyss },
});

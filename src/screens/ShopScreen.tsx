import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ProfileCategory, ShopItem, PROFILE_COLUMN, isOwned, loadShop, confirmPurchase } from '../lib/shop';
import { OctopusData } from '../lib/octopus';
import { Rarity, boxOdds, boxPool, loadRarities, openBlindBox } from '../lib/blindBox';
import type { RootStackParamList } from '../navigation/AppNavigator';
import SectionHeader from '../components/SectionHeader';
import ShopTile, { TileStatus } from '../components/ShopTile';
import Octopus from '../components/Octopus';
import FilmStamp from '../components/FilmStamp';
import CosmeticSwatch from '../components/CosmeticSwatch';
import Clam from '../components/Clam';
import BlindBoxModal from '../components/BlindBoxModal';
import { Text, TextInput } from '../components/Themed';
import { colors, bubbly } from '../theme';
import Wave from '../components/Wave';

type Profile = {
  username: string;
  avatar_url: string | null;
  avatar_frame_color: string;
  banner_color: string;
  badge: string;
  currency_balance: number;
};

type Suggestion = {
  id: string;
  title: string;
  status: 'pending' | 'approved' | 'declined';
};

const PROFILE_SECTIONS: Array<{ category: ProfileCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { category: 'frame', label: 'Frames', icon: 'ellipse-outline' },
  { category: 'banner', label: 'Banners', icon: 'image-outline' },
  { category: 'badge', label: 'Badges', icon: 'ribbon-outline' },
];

const STATUS_STYLES: Record<Suggestion['status'], { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.sand, fg: colors.muted, label: 'In review' },
  approved: { bg: '#ecfdf5', fg: '#047857', label: 'Approved' },
  declined: { bg: '#fef2f2', fg: '#b91c1c', label: 'Declined' },
};

export default function ShopScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [octopus, setOctopus] = useState<OctopusData | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [blindBoxOpen, setBlindBoxOpen] = useState(false);

  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Tapping a tile previews it in the header without buying or equipping
  const [preview, setPreview] = useState<Partial<Record<ProfileCategory, ShopItem>>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: profileData }, { data: octoData }, { data: suggestionData }, shop, rarityList] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, avatar_url, avatar_frame_color, banner_color, badge, currency_balance')
        .eq('id', user.id)
        .single(),
      supabase
        .from('octopuses')
        .select('user_id, name, color, accessory, held_item, dialogue')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('theme_suggestions')
        .select('id, title, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      loadShop(user.id),
      loadRarities(),
    ]);
    if (profileData) setProfile(profileData);
    setOctopus(octoData);
    setSuggestions(suggestionData ?? []);
    setItems(shop.items);
    setOwnedIds(shop.ownedIds);
    setRarities(rarityList);
  }, [user]);

  // Reload on every focus so the balance reflects daily posts and payouts
  useFocusEffect(
    useCallback(() => {
      setPreview({});
      load().finally(() => setIsLoading(false));
    }, [load])
  );

  const equip = async (item: ShopItem) => {
    if (!user || !profile) return;
    const column = PROFILE_COLUMN[item.category as ProfileCategory];
    const previous = profile[column];

    setProfile({ ...profile, [column]: item.value });
    const { error } = await supabase.from('profiles').update({ [column]: item.value }).eq('id', user.id);
    if (error) {
      setProfile((p) => (p ? { ...p, [column]: previous } : p));
      Alert.alert('Couldn’t equip that', error.message);
    }
  };

  const buy = (item: ShopItem, equipAfter: boolean) => {
    if (!profile) return;
    confirmPurchase(
      item,
      profile.currency_balance,
      (newBalance) => {
        setOwnedIds((prev) => new Set(prev).add(item.id));
        setProfile((p) => (p ? { ...p, currency_balance: newBalance } : p));
        if (equipAfter) equip(item);
      },
      (busy) => setBusyItemId(busy ? item.id : null)
    );
  };

  const ticket = items.find((i) => i.category === 'ticket');
  const blindBox = items.find((i) => i.category === 'blind_box' && i.is_purchasable);
  const blindBoxOdds = boxOdds(boxPool(items, ownedIds), rarities);

  // Opens on the server, then adds the finds to what you own
  const openClam = async () => {
    if (!blindBox) return [];
    const result = await openBlindBox(blindBox.id);
    setOwnedIds((prev) => new Set([...prev, ...result.item_ids]));
    setProfile((p) => (p ? { ...p, currency_balance: result.balance } : p));
    return result.item_ids
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is ShopItem => !!i);
  };

  const submitTicket = () => {
    if (!profile || !ticket) return;
    const title = ticketTitle.trim();
    if (title.length < 2) {
      Alert.alert('Name your theme', 'Give your suggestion a short title, like “Reflections”.');
      return;
    }
    if (profile.currency_balance < ticket.price) {
      Alert.alert('Not enough shutters', `A ticket costs ${ticket.price} shutters.`);
      return;
    }

    Alert.alert(`Suggest “${title}”?`, `This uses a ticket for ${ticket.price} shutters.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setIsSubmittingTicket(true);
          const { data: newBalance, error } = await supabase.rpc('submit_theme_suggestion', {
            p_title: title,
            p_description: ticketDescription.trim(),
          });
          setIsSubmittingTicket(false);

          if (error) {
            Alert.alert('Couldn’t submit', error.message);
            return;
          }
          setProfile((p) => (p ? { ...p, currency_balance: newBalance as number } : p));
          setTicketTitle('');
          setTicketDescription('');
          load();
          Alert.alert('Fin-tastic idea!', 'Your theme is in review. We\u2019ll let it soak.');
        },
      },
    ]);
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.deep} />
      </SafeAreaView>
    );
  }

  const shown = {
    frame: preview.frame?.value ?? profile.avatar_frame_color,
    banner: preview.banner?.value ?? profile.banner_color,
    badge: preview.badge?.value ?? profile.badge,
  };
  const shownBadgeLabel = items.find((i) => i.category === 'badge' && i.value === shown.badge)?.label ?? 'streak';
  const isPreviewing = Object.keys(preview).length > 0;

  const profileStatus = (item: ShopItem): TileStatus => {
    if (profile[PROFILE_COLUMN[item.category as ProfileCategory]] === item.value) return 'equipped';
    if (isOwned(item, ownedIds)) return 'owned';
    return item.is_purchasable ? 'buy' : 'locked';
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: shown.banner }]} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Shop</Text>
        <View style={styles.balancePill}>
          <Ionicons name="flash" size={13} color="#92400e" />
          <Text style={styles.balanceText}>{profile.currency_balance} shutters</Text>
        </View>
      </View>

      <View style={styles.header}>
        <View style={[styles.avatar, { borderColor: shown.frame }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        <View style={styles.badgePill}>
          <Ionicons name={shown.badge as keyof typeof Ionicons.glyphMap} size={13} color="#92400e" />
          <Text style={styles.badgePillText}>{shownBadgeLabel}</Text>
        </View>
        {isPreviewing && (
          <Pressable onPress={() => setPreview({})}>
            <Text style={styles.resetPreview}>Previewing · tap to reset</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.sheet}>
        <Wave />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {octopus && (
            <>
              <SectionHeader icon="happy-outline" label="Your octopus" />
              <Pressable style={styles.octoCard} onPress={() => navigation.push('Octopus')}>
                <Octopus color={octopus.color} accessory={octopus.accessory} heldItem={octopus.held_item} size={64} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.octoName}>{octopus.name}</Text>
                  <Text style={styles.octoBlurb}>Colors, accessories, items and lines for your octopus.</Text>
                </View>
                <View style={styles.octoButton}>
                  <Text style={styles.octoButtonText}>Customize</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.white} />
                </View>
              </Pressable>
            </>
          )}

          {blindBox && (
            <>
              <SectionHeader icon="gift-outline" label="Blind box" />
              <Pressable style={styles.clamCard} onPress={() => setBlindBoxOpen(true)}>
                <Clam size={78} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clamTitle}>{blindBox.label}</Text>
                  <Text style={styles.octoBlurb}>
                    {blindBoxOdds.length >= 2
                      ? '2 surprise accessories for your octopus. Tap to see what\u2019s inside.'
                      : 'You\u2019ve nearly collected them all. Tap for details.'}
                  </Text>
                </View>
                <View style={styles.clamPrice}>
                  <Ionicons name="flash" size={12} color={colors.white} />
                  <Text style={styles.octoButtonText}>{blindBox.price}</Text>
                </View>
              </Pressable>
            </>
          )}

          {PROFILE_SECTIONS.map((section) => (
            <View key={section.category}>
              <SectionHeader icon={section.icon} label={section.label} />
              <View style={styles.grid}>
                {items
                  .filter((i) => i.category === section.category)
                  .map((item) => (
                    <ShopTile
                      key={item.id}
                      label={item.label}
                      swatch={<CosmeticSwatch category={section.category} value={item.value} />}
                      status={profileStatus(item)}
                      price={item.price}
                      hint={item.unlock_hint}
                      busy={busyItemId === item.id}
                      selected={preview[section.category]?.id === item.id}
                      onPress={() => setPreview((p) => ({ ...p, [section.category]: item }))}
                      onEquip={() => equip(item)}
                      onBuy={() => buy(item, true)}
                    />
                  ))}
              </View>
            </View>
          ))}

          <SectionHeader icon="film-outline" label="Film stamps" />
          <Text style={styles.sectionBlurb}>
            Tag your film submissions with the stock you shot on. Pick one when you submit a film photo.
          </Text>
          <View style={styles.grid}>
            {items
              .filter((i) => i.category === 'stamp')
              .map((item) => (
                <ShopTile
                  key={item.id}
                  label={item.label}
                  swatch={
                    <View style={styles.stampSwatch}>
                      <FilmStamp stock={item.value} accent={item.accent} size="small" />
                    </View>
                  }
                  status={isOwned(item, ownedIds) ? 'collected' : 'buy'}
                  price={item.price}
                  busy={busyItemId === item.id}
                  onBuy={() => buy(item, false)}
                />
              ))}
          </View>

          {ticket && (
            <>
              <SectionHeader icon="ticket-outline" label="Theme tickets" />
              <View style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Ionicons name="ticket" size={18} color="#92400e" />
                  <Text style={styles.ticketTitle}>Suggest next week{'’'}s theme</Text>
                </View>
                <Text style={styles.ticketBlurb}>
                  Spend a ticket to pitch a theme. Every suggestion gets reviewed, and the good ones make it
                  into the rotation.
                </Text>
                <TextInput
                  style={styles.ticketInput}
                  placeholder="Theme, e.g. Reflections"
                  value={ticketTitle}
                  onChangeText={setTicketTitle}
                  maxLength={40}
                />
                <TextInput
                  style={[styles.ticketInput, styles.ticketInputMultiline]}
                  placeholder="Why it would be fun to shoot (optional)"
                  value={ticketDescription}
                  onChangeText={setTicketDescription}
                  maxLength={200}
                  multiline
                />
                <Pressable
                  style={[styles.ticketButton, isSubmittingTicket && { opacity: 0.6 }]}
                  onPress={submitTicket}
                  disabled={isSubmittingTicket}
                >
                  {isSubmittingTicket ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Text style={styles.ticketButtonText}>Use ticket</Text>
                      <Ionicons name="flash" size={12} color={colors.white} />
                      <Text style={styles.ticketButtonText}>{ticket.price}</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {suggestions.length > 0 && (
                <View style={styles.suggestionList}>
                  {suggestions.map((s) => {
                    const st = STATUS_STYLES[s.status];
                    return (
                      <View key={s.id} style={styles.suggestionRow}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusChipText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <BlindBoxModal
        box={blindBoxOpen && blindBox ? blindBox : null}
        odds={blindBoxOdds}
        balance={profile.currency_balance}
        octopusColor={octopus?.color ?? '#a78bfa'}
        onOpen={openClam}
        onClose={() => setBlindBoxOpen(false)}
        onCustomize={() => {
          setBlindBoxOpen(false);
          navigation.push('Octopus');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { ...bubbly, fontSize: 28 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balanceText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 26 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.coralLight,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 18, fontWeight: '600', color: colors.coral },
  username: { ...bubbly, fontSize: 22, marginBottom: 6 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePillText: { fontSize: 11, color: '#92400e', fontWeight: '500' },
  resetPreview: { fontSize: 11, color: colors.muted, marginTop: 8 },

  sheet: {
    flex: 1,
    backgroundColor: colors.shell,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sectionBlurb: { fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },

  stampSwatch: { height: 40, justifyContent: 'center' },

  octoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sand,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  octoName: { fontSize: 15, fontWeight: '700', color: colors.deep },
  clamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.reefLight,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.reefBorder,
    padding: 12,
    marginBottom: 18,
  },
  clamTitle: { ...bubbly, fontSize: 18 },
  clamPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.deep,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  octoBlurb: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  octoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  octoButtonText: { fontSize: 12, color: colors.white, fontWeight: '600' },

  ticketCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d97706',
    backgroundColor: colors.sandLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ticketTitle: { fontSize: 14, fontWeight: '700', color: '#78350f' },
  ticketBlurb: { fontSize: 12, color: '#92400e', lineHeight: 17, marginBottom: 10 },
  ticketInput: {
    backgroundColor: colors.shell,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 8,
  },
  ticketInputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 11,
  },
  ticketButtonText: { fontSize: 13, color: colors.white, fontWeight: '600' },

  suggestionList: { gap: 6, marginBottom: 18 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionTitle: { flex: 1, fontSize: 13, color: colors.text },
  statusChip: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: '600' },
});

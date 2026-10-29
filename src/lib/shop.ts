import { Alert } from 'react-native';
import { supabase } from './supabase';

export type ProfileCategory = 'frame' | 'banner' | 'badge';
export type OctoCategory = 'octo_color' | 'octo_accessory' | 'octo_item' | 'octo_pet' | 'octo_dialogue';
export type ShopCategory = ProfileCategory | OctoCategory | 'stamp' | 'ticket' | 'blind_box';

export type ShopItem = {
  id: string;
  category: ShopCategory;
  value: string;
  label: string;
  price: number;
  is_purchasable: boolean;
  unlock_hint: string | null;
  accent: string | null;
  rarity: string; // rarities.id, e.g. 'common'
  in_blind_box: boolean;
};

// Maps each profile cosmetic category to the profile column it equips into
export const PROFILE_COLUMN: Record<ProfileCategory, 'avatar_frame_color' | 'banner_color' | 'badge'> = {
  frame: 'avatar_frame_color',
  banner: 'banner_color',
  badge: 'badge',
};

// Free starters (price 0, purchasable) belong to everyone; everything else
// has to be in the user's inventory, either bought or earned.
export function isOwned(item: ShopItem, ownedIds: Set<string>) {
  return (item.price === 0 && item.is_purchasable) || ownedIds.has(item.id);
}

export async function loadShop(userId: string) {
  const [{ data: items }, { data: inventory }] = await Promise.all([
    supabase
      .from('shop_items')
      .select('id, category, value, label, price, is_purchasable, unlock_hint, accent, rarity, in_blind_box')
      .order('sort_order'),
    supabase.from('user_inventory').select('item_id').eq('user_id', userId),
  ]);

  return {
    items: (items ?? []) as ShopItem[],
    ownedIds: new Set((inventory ?? []).map((r) => r.item_id as string)),
  };
}

// Confirms with the user, then buys through the server (which checks the
// price and balance). Calls onBought with the new balance on success.
export function confirmPurchase(
  item: ShopItem,
  balance: number,
  onBought: (newBalance: number) => void,
  setBusy?: (busy: boolean) => void
) {
  if (balance < item.price) {
    Alert.alert(
      'Not enough shutters',
      `You\u2019re ${item.price - balance} short. Don\u2019t flounder: post daily photos and place in weekly themes to earn more.`
    );
    return;
  }

  Alert.alert(`Buy ${item.label}?`, `This costs ${item.price} shutters.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Buy',
      onPress: async () => {
        setBusy?.(true);
        const { data, error } = await supabase.rpc('purchase_item', { p_item_id: item.id });
        setBusy?.(false);
        if (error) {
          Alert.alert('Purchase failed', error.message);
          return;
        }
        onBought(data as number);
      },
    },
  ]);
}

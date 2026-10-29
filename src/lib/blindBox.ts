import { supabase } from './supabase';
import { ShopItem } from './shop';

export const ITEMS_PER_BOX = 2;

export type Rarity = {
  id: string;
  label: string;
  weight: number; // chance out of 100 that one pull lands in this tier
};

export type TierOdds = {
  rarity: Rarity;
  chance: number; // 0-1, per pull
  items: ShopItem[];
};

export type Pick = { item: ShopItem; duplicateId: string | null };
export type Duplicate = { id: string; item: ShopItem };

// Accent colors for each rarity tier's chip
export const RARITY_COLORS: Record<string, { bg: string; fg: string }> = {
  common: { bg: '#E0EEF2', fg: '#3F6F82' },
  uncommon: { bg: '#DDF5E3', fg: '#23774A' },
  rare: { bg: '#D6ECFF', fg: '#1D5FA8' },
  epic: { bg: '#EBDDFB', fg: '#6B3FA0' },
  legendary: { bg: '#FCE8B2', fg: '#9A6400' },
};

const BOX_CATEGORIES = ['octo_accessory', 'octo_item', 'octo_pet'];

// Duplicates sell back for half the item's price
export const sellValue = (item: ShopItem) => Math.floor(item.price / 2);

export async function loadRarities() {
  const { data } = await supabase.from('rarities').select('id, label, weight').order('sort_order');
  return (data ?? []).map((r) => ({ ...r, weight: Number(r.weight) })) as Rarity[];
}

// Each pull rolls a tier by weight (only tiers with something in them), then
// an item evenly within it. Mirrors open_blind_box on the server.
export function tierOdds(items: ShopItem[], rarities: Rarity[]): TierOdds[] {
  const inBox = items.filter((i) => BOX_CATEGORIES.includes(i.category) && i.in_blind_box);
  const tiers = rarities
    .map((rarity) => ({ rarity, items: inBox.filter((i) => i.rarity === rarity.id) }))
    .filter((t) => t.items.length > 0);
  const total = tiers.reduce((sum, t) => sum + t.rarity.weight, 0);
  return tiers.map((t) => ({ ...t, chance: total ? t.rarity.weight / total : 0 }));
}

export async function openBlindBox(boxId: string, items: ShopItem[]) {
  const { data, error } = await supabase.rpc('open_blind_box', { p_box_id: boxId });
  if (error) throw error;
  const result = data as { balance: number; picks: Array<{ item_id: string; duplicate_id: string | null }> };
  const byId = new Map(items.map((i) => [i.id, i]));
  return {
    balance: result.balance,
    picks: result.picks
      .map((p) => ({ item: byId.get(p.item_id), duplicateId: p.duplicate_id }))
      .filter((p): p is Pick => !!p.item),
  };
}

export async function loadDuplicates(userId: string, items: ShopItem[]): Promise<Duplicate[]> {
  const { data } = await supabase
    .from('blind_box_duplicates')
    .select('id, item_id')
    .eq('user_id', userId)
    .order('created_at');
  const byId = new Map(items.map((i) => [i.id, i]));
  return (data ?? [])
    .map((d) => ({ id: d.id as string, item: byId.get(d.item_id) }))
    .filter((d): d is Duplicate => !!d.item);
}

export async function sellDuplicate(duplicateId: string) {
  const { data, error } = await supabase.rpc('sell_duplicate', { p_duplicate_id: duplicateId });
  if (error) throw error;
  return data as { balance: number; refund: number };
}

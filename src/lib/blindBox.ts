import { supabase } from './supabase';
import { ShopItem, isOwned } from './shop';

export const ITEMS_PER_BOX = 2;

export type Rarity = {
  id: string;
  label: string;
  weight: number;
};

export type BoxOdds = {
  item: ShopItem;
  rarity: Rarity;
  chance: number; // 0-1, chance this item is one of the box's picks
};

// Accent colors for each rarity tier's chip
export const RARITY_COLORS: Record<string, { bg: string; fg: string }> = {
  common: { bg: '#E0EEF2', fg: '#3F6F82' },
  rare: { bg: '#D6ECFF', fg: '#1D5FA8' },
  epic: { bg: '#EBDDFB', fg: '#6B3FA0' },
  legendary: { bg: '#FCE8B2', fg: '#9A6400' },
};

export async function loadRarities() {
  const { data } = await supabase.from('rarities').select('id, label, weight').order('sort_order');
  return (data ?? []).map((r) => ({ ...r, weight: Number(r.weight) })) as Rarity[];
}

// What this user could still pull: blind-box accessories they don't own.
// Mirrors the pool in the open_blind_box function on the server.
export function boxPool(items: ShopItem[], ownedIds: Set<string>) {
  return items.filter((i) => i.category === 'octo_accessory' && i.in_blind_box && !isOwned(i, ownedIds));
}

// Exact chance each item lands in a box of two, for a weighted draw without
// replacement: picked first, or picked second after some other item went first.
export function boxOdds(pool: ShopItem[], rarities: Rarity[]): BoxOdds[] {
  const byId = new Map(rarities.map((r) => [r.id, r]));
  const fallback: Rarity = { id: 'common', label: 'Common', weight: 1 };
  const entries = pool.map((item) => ({ item, rarity: byId.get(item.rarity) ?? fallback }));
  const total = entries.reduce((sum, e) => sum + e.rarity.weight, 0);
  if (total === 0) return [];

  return entries
    .map(({ item, rarity }) => {
      const w = rarity.weight;
      let chance = w / total;
      for (const other of entries) {
        if (other.item.id === item.id) continue;
        const wo = other.rarity.weight;
        chance += (wo / total) * (w / (total - wo));
      }
      return { item, rarity, chance: Math.min(chance, 1) };
    })
    .sort((a, b) => b.chance - a.chance || a.item.label.localeCompare(b.item.label));
}

export async function openBlindBox(boxId: string) {
  const { data, error } = await supabase.rpc('open_blind_box', { p_box_id: boxId });
  if (error) throw error;
  return data as { balance: number; item_ids: string[] };
}

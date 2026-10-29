import { supabase } from './supabase';

export type OctopusData = {
  user_id: string;
  name: string;
  color: string;
  accessory: string | null;
  held_item: string | null;
  pet: string | null;
  dialogue: string;
};

// Columns on `octopuses` each octopus shop category equips into
export const OCTO_COLUMN = {
  octo_color: 'color',
  octo_accessory: 'accessory',
  octo_item: 'held_item',
  octo_pet: 'pet',
  octo_dialogue: 'dialogue',
} as const;

export const DEFAULT_LINE = 'Hi! I’m {name}.';

// Loads an octopus plus the text of its equipped dialogue line
export async function loadOctopus(userId: string) {
  const { data: octopus } = await supabase
    .from('octopuses')
    .select('user_id, name, color, accessory, held_item, pet, dialogue')
    .eq('user_id', userId)
    .maybeSingle();

  if (!octopus) return { octopus: null, line: DEFAULT_LINE };

  const { data: lineItem } = await supabase
    .from('shop_items')
    .select('label')
    .eq('category', 'octo_dialogue')
    .eq('value', octopus.dialogue)
    .maybeSingle();

  return { octopus: octopus as OctopusData, line: lineItem?.label ?? DEFAULT_LINE };
}

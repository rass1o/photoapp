import { supabase } from './supabase';

// Starts the next weekly theme if the last one has ended (the server picks
// it from the rotation). Call before loading the current theme. Failing is
// harmless: the screen just shows whatever theme exists.
export async function ensureCurrentTheme() {
  const { error } = await supabase.rpc('ensure_current_theme');
  if (error) console.log('Theme rollover check failed:', error.message);
}

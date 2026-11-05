-- Soupy the pug joins the legendary sidekicks in the coral clam.
-- (Mand's new curled-up look is app-only; nothing to change here.)
-- Run after 20261116_goop_mand_most_liked.sql.

insert into public.shop_items
  (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box, box)
values
  ('octo-pet-soupy', 'octo_pet', 'soupy', 'Soupy', 150, false, 'Legendary · find it in a clam', 11, 'legendary', true, 'clam')
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box,
  box = excluded.box;

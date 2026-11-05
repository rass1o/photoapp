-- A second animated legendary banner for the pearl clam: Jellyfish bloom.
-- (Its art and animation live in the app: BannerArt.tsx / AnimatedBanner.tsx.)
-- Run after 20261114_likes_and_new_prizes.sql.

insert into public.shop_items
  (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box, box)
values
  ('banner-jellyfish', 'banner', 'jellyfish', 'Jellyfish bloom', 150, false, 'Found in the pearl clam', 15, 'legendary', true, 'pearl')
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box,
  box = excluded.box;

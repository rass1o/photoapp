-- Five more legendary sidekicks (Mango, Leila, Gibson, Tuxie, Ginger) and
-- sixteen everyday held items, four per rarity, all in the clam.
-- Run after 20261106_one_account_per_inbox.sql. The art lives in the app
-- (Sidekick.tsx, Octopus.tsx); only the rows are new here.

insert into public.shop_items
  (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box)
values
  -- legendary sidekicks, clam-only
  ('octo-pet-mango',           'octo_pet',  'mango',           'Mango',           150, false, 'Legendary · find it in a clam', 3, 'legendary', true),
  ('octo-pet-leila',           'octo_pet',  'leila',           'Leila',           150, false, 'Legendary · find it in a clam', 4, 'legendary', true),
  ('octo-pet-gibson',          'octo_pet',  'gibson',          'Gibson',          150, false, 'Legendary · find it in a clam', 5, 'legendary', true),
  ('octo-pet-tuxie',           'octo_pet',  'tuxie',           'Tuxie',           150, false, 'Legendary · find it in a clam', 6, 'legendary', true),
  ('octo-pet-ginger',          'octo_pet',  'ginger',          'Ginger',          150, false, 'Legendary · find it in a clam', 7, 'legendary', true),
  -- common
  ('octo-item-book',           'octo_item', 'book',            'Book',             20, true,  null,  9, 'common',   true),
  ('octo-item-donut',          'octo_item', 'donut',           'Donut',            20, true,  null, 10, 'common',   true),
  ('octo-item-banana',         'octo_item', 'banana',          'Banana',           20, true,  null, 11, 'common',   true),
  ('octo-item-rubber-duck',    'octo_item', 'rubber_duck',     'Rubber duck',      20, true,  null, 12, 'common',   true),
  -- uncommon
  ('octo-item-pizza',          'octo_item', 'pizza',           'Pizza slice',      40, true,  null, 13, 'uncommon', true),
  ('octo-item-boba',           'octo_item', 'boba',            'Boba tea',         40, true,  null, 14, 'uncommon', true),
  ('octo-item-ice-cream',      'octo_item', 'ice_cream',       'Ice cream',        40, true,  null, 15, 'uncommon', true),
  ('octo-item-controller',     'octo_item', 'game_controller', 'Game controller',  40, true,  null, 16, 'uncommon', true),
  -- rare
  ('octo-item-burger',         'octo_item', 'burger',          'Burger',           60, true,  null, 17, 'rare',     true),
  ('octo-item-cactus',         'octo_item', 'cactus',          'Cactus',           60, true,  null, 18, 'rare',     true),
  ('octo-item-popcorn',        'octo_item', 'popcorn',         'Popcorn',          60, true,  null, 19, 'rare',     true),
  ('octo-item-umbrella',       'octo_item', 'umbrella',        'Umbrella',         60, true,  null, 20, 'rare',     true),
  -- epic
  ('octo-item-guitar',         'octo_item', 'guitar',          'Guitar',          100, true,  null, 21, 'epic',     true),
  ('octo-item-birthday-cake',  'octo_item', 'birthday_cake',   'Birthday cake',   100, true,  null, 22, 'epic',     true),
  ('octo-item-boombox',        'octo_item', 'boombox',         'Boombox',         100, true,  null, 23, 'epic',     true),
  ('octo-item-disco-ball',     'octo_item', 'disco_ball',      'Disco ball',      100, true,  null, 24, 'epic',     true)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  sort_order = excluded.sort_order,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box;

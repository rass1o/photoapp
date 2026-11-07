-- Trim the frame and banner lineup and tidy the legendaries.
-- Run after 20261123_ticket_price_retire_stamps.sql. Safe to re-run.
--
--  * Removed banners: Orca, Island camp, Dolphins, Seahorse herd, Whale.
--    Removed frames: Whale tail, Bow.
--    Anyone who owned one gets its price back in shutters (unsold duplicates
--    pay their sell-back value, half the price), and anyone wearing one goes
--    back to the default frame or banner.
--  * Legendary is now just: Sunset sail, Jellyfish bloom, Anglerfish chase,
--    Cat and fish, Glowing bay, Koi pond, Starfall (banners) and Mama
--    seahorse, Merlin (was Purring cat), Koi pair, Jellyfish crown, Royal,
--    Angler glow, Ocho peek (frames). Sea turtle and Sea dragon move to epic.
--
-- The removed items are listed in each statement (no temporary table), so
-- it works however the SQL Editor runs it.

-- refunds: the full price for owned items, half for duplicates
update public.profiles p
set currency_balance = p.currency_balance + r.total
from (
  select user_id, sum(total) as total
  from (
    select ui.user_id, si.price as total
    from public.user_inventory ui
    join public.shop_items si on si.id = ui.item_id
    where si.id in ('banner-orca', 'banner-island-camp', 'banner-dolphins', 'banner-seahorses', 'banner-whale', 'frame-whale-tail', 'frame-bow')
    union all
    select d.user_id, floor(si.price / 2)::int
    from public.blind_box_duplicates d
    join public.shop_items si on si.id = d.item_id
    where si.id in ('banner-orca', 'banner-island-camp', 'banner-dolphins', 'banner-seahorses', 'banner-whale', 'frame-whale-tail', 'frame-bow')
  ) owed
  group by user_id
) r
where p.id = r.user_id;

-- nobody keeps wearing something that's gone
update public.profiles set banner_color = '#D9E2E6'
where banner_color in ('orca', 'island_camp', 'dolphins', 'seahorses', 'whale');
update public.profiles set avatar_frame_color = '#7c3aed'
where avatar_frame_color in ('whale_tail', 'bow');

delete from public.blind_box_duplicates
where item_id in ('banner-orca', 'banner-island-camp', 'banner-dolphins', 'banner-seahorses', 'banner-whale', 'frame-whale-tail', 'frame-bow');
-- (user_inventory rows go with the item)
delete from public.shop_items
where id in ('banner-orca', 'banner-island-camp', 'banner-dolphins', 'banner-seahorses', 'banner-whale', 'frame-whale-tail', 'frame-bow');

update public.shop_items set label = 'Merlin' where id = 'frame-cat-purr';
update public.shop_items set rarity = 'epic', price = 100 where id in ('frame-sea-turtle', 'frame-dragon');

-- Clearer names for the two blind boxes: Ocho's Clam (gear, outfits and
-- sidekicks for Ocho) and the Profile Clam (frames and banners for your
-- account). The app shows these names already; this updates the stored
-- labels and the "where to find it" hints on items to match.
-- Run after 20261121_more_frames_banners.sql. Safe to re-run.

update public.shop_items set label = 'Ocho''s Clam' where id = 'blind-box-clam';
update public.shop_items set label = 'Profile Clam' where id = 'blind-box-pearl';

update public.shop_items set unlock_hint = 'Found in the Profile Clam' where unlock_hint = 'Found in the pearl clam';
update public.shop_items set unlock_hint = replace(unlock_hint, 'in a clam', 'in Ocho''s Clam') where unlock_hint like '%in a clam%';

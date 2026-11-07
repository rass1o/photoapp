-- Theme tickets now cost 1,000 shutters, and film stamps are retired: they
-- can't be bought anymore (photos that already have one keep showing it).
-- Run after 20261122_clam_names.sql. Safe to re-run.

update public.shop_items set price = 1000 where id = 'ticket-theme-suggestion';

update public.shop_items set is_purchasable = false, unlock_hint = 'Retired' where category = 'stamp';

-- Ocho, the ShuttInk mascot: default octopus name + pun dialogue lines.
-- Run after 20261028_octopus_stamps_tickets.sql. Safe to re-run.

alter table public.octopuses alter column name set default 'Ocho';

-- Rename octopuses nobody has named yet (they still have the old default)
update public.octopuses set name = 'Ocho' where name = 'Inky';

insert into public.shop_items (id, category, value, label, price, is_purchasable, sort_order) values
  ('octo-line-kraken',   'octo_dialogue', 'kraken',   'That shot is kraken me up.',          10, true, 7),
  ('octo-line-seas',     'octo_dialogue', 'seas',     'Seas the day. Shoot the light.',      10, true, 8),
  ('octo-line-shell',    'octo_dialogue', 'shell',    'Shell yeah, it''s golden hour!',      15, true, 9),
  ('octo-line-lens',     'octo_dialogue', 'lens',     'My eyes are basically lenses, you know.', 15, true, 10),
  ('octo-line-tentacle', 'octo_dialogue', 'tentacle', 'I''m tentacle-ly obsessed with film.', 15, true, 11)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  sort_order = excluded.sort_order;

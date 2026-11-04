-- Sidekicks aren't only legendary anymore: Leila moves down to epic, and
-- Harold the chicken (in his apron) joins her there. Both are still found
-- only in a clam. Run after 20261110_theme_rotation.sql.

update public.shop_items
set rarity = 'epic',
    price = 100,
    unlock_hint = 'Epic · find it in a clam'
where id = 'octo-pet-leila';

insert into public.shop_items
  (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box)
values
  ('octo-pet-harold', 'octo_pet', 'harold', 'Harold', 100, false, 'Epic · find it in a clam', 8, 'epic', true)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box;

select id, rarity, price from public.shop_items where id in ('octo-pet-leila', 'octo-pet-harold');

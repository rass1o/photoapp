-- Clam blind box: 100 shutters for 2 random octopus accessories.
-- Run after 20261031_top5_payouts.sql. Safe to re-run.
--
-- Odds come from rarity weights, so adding rarer accessories later is just:
--   insert the accessory with rarity 'rare' (etc.) and in_blind_box = true.
-- Set is_purchasable = false on it to make it blind-box only.

------------------------------------------------------------------------------
-- Rarities (readable by the app, which shows the odds)
------------------------------------------------------------------------------
create table if not exists public.rarities (
  id text primary key,
  label text not null,
  weight numeric not null check (weight > 0), -- relative chance per item
  sort_order int not null default 0
);

alter table public.rarities enable row level security;
drop policy if exists "rarities are public" on public.rarities;
create policy "rarities are public" on public.rarities for select using (true);

insert into public.rarities (id, label, weight, sort_order) values
  ('common',    'Common',    60, 0),
  ('rare',      'Rare',      25, 1),
  ('epic',      'Epic',      12, 2),
  ('legendary', 'Legendary',  3, 3)
on conflict (id) do update set label = excluded.label, weight = excluded.weight, sort_order = excluded.sort_order;

alter table public.shop_items add column if not exists rarity text not null default 'common' references public.rarities(id);
alter table public.shop_items add column if not exists in_blind_box boolean not null default false;

alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check check (
  category in ('frame', 'banner', 'badge', 'stamp', 'octo_color', 'octo_accessory', 'octo_item',
               'octo_dialogue', 'ticket', 'blind_box')
);

-- Every accessory in the shop today goes in the box
update public.shop_items set in_blind_box = true where category = 'octo_accessory' and price > 0;

insert into public.shop_items (id, category, value, label, price, is_purchasable, sort_order) values
  ('blind-box-clam', 'blind_box', 'clam', 'Clam blind box', 100, true, 0)
on conflict (id) do update set label = excluded.label, price = excluded.price;

------------------------------------------------------------------------------
-- purchase_item: same as before, but tickets and blind boxes have their
-- own functions and can't be bought into inventory
------------------------------------------------------------------------------
create or replace function public.purchase_item(p_item_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  item shop_items;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into item from shop_items where id = p_item_id;
  if not found or not item.is_purchasable or item.category in ('ticket', 'blind_box') then
    raise exception 'That item isn''t for sale';
  end if;

  if item.price = 0
     or exists (select 1 from user_inventory where user_id = auth.uid() and item_id = p_item_id) then
    raise exception 'You already own this';
  end if;

  update profiles
  set currency_balance = currency_balance - item.price
  where id = auth.uid() and currency_balance >= item.price
  returning currency_balance into new_balance;

  if not found then
    raise exception 'Not enough shutters';
  end if;

  insert into user_inventory (user_id, item_id) values (auth.uid(), p_item_id);

  return new_balance;
end;
$$;

------------------------------------------------------------------------------
-- Open a blind box. Picks 2 different accessories the user doesn't own yet,
-- weighted by rarity, charges the box price and grants both, all at once.
-- Returns { balance, item_ids }.
------------------------------------------------------------------------------
create or replace function public.open_blind_box(p_box_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  box shop_items;
  picked text[];
  new_balance int;
  per_box constant int := 2;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into box from shop_items where id = p_box_id and category = 'blind_box' and is_purchasable;
  if not found then
    raise exception 'That blind box isn''t available';
  end if;

  -- Lock the buyer's row so two quick taps can't both draw the same items
  perform 1 from profiles where id = auth.uid() for update;

  -- Weighted draw without replacement: sort by -ln(u)/weight, take the
  -- first two (each pick is proportional to weight among what's left)
  select array_agg(id) into picked
  from (
    select i.id
    from shop_items i
    join rarities r on r.id = i.rarity
    where i.category = 'octo_accessory'
      and i.in_blind_box
      and not (i.price = 0 and i.is_purchasable) -- free starters are already everyone's
      and not exists (select 1 from user_inventory u where u.user_id = auth.uid() and u.item_id = i.id)
    order by -ln(1 - random()) / r.weight
    limit per_box
  ) draw;

  if coalesce(array_length(picked, 1), 0) < per_box then
    raise exception 'You''ve collected almost everything in this clam. Grab the rest from the shop!';
  end if;

  update profiles
  set currency_balance = currency_balance - box.price
  where id = auth.uid() and currency_balance >= box.price
  returning currency_balance into new_balance;

  if not found then
    raise exception 'Not enough shutters';
  end if;

  insert into user_inventory (user_id, item_id)
  select auth.uid(), unnest(picked)
  on conflict do nothing;

  return json_build_object('balance', new_balance, 'item_ids', to_json(picked));
end;
$$;

revoke all on function public.open_blind_box(text) from public, anon;
grant execute on function public.open_blind_box(text) to authenticated;

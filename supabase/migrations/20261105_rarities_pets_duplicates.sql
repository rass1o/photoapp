-- Five rarities with prices to match, new accessories and items, legendary
-- sidekick pets, and a clam blind box that can roll duplicates you sell back
-- for half price. Run after 20261104_streak_bonus_and_prizes.sql.

------------------------------------------------------------------------------
-- Rarities. weight is now the chance (out of 100) that one pull from the
-- clam lands in that tier; an item is then picked evenly within the tier.
------------------------------------------------------------------------------
insert into public.rarities (id, label, weight, sort_order) values
  ('common',    'Common',    40, 0),
  ('uncommon',  'Uncommon',  30, 1),
  ('rare',      'Rare',      16, 2),
  ('epic',      'Epic',       9, 3),
  ('legendary', 'Legendary',  5, 4)
on conflict (id) do update set label = excluded.label, weight = excluded.weight, sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Pets: a new octopus slot, shown beside it
------------------------------------------------------------------------------
alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check check (
  category in ('frame', 'banner', 'badge', 'stamp', 'octo_color', 'octo_accessory', 'octo_item',
               'octo_pet', 'octo_dialogue', 'ticket', 'blind_box')
);

alter table public.octopuses add column if not exists pet text; -- null = none

------------------------------------------------------------------------------
-- Items: new ones, plus a rarity for everything the clam can hold.
-- Legendary pets are clam-only (is_purchasable = false).
------------------------------------------------------------------------------
insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order) values
  ('octo-acc-cat-ears',       'octo_accessory', 'cat_ears',     'Cat ears',     60,  true,  null, 6),
  ('octo-acc-sombrero',       'octo_accessory', 'sombrero',     'Sombrero',     60,  true,  null, 7),
  ('octo-item-sword',         'octo_item',      'sword',        'Sword',        40,  true,  null, 5),
  ('octo-item-light-meter',   'octo_item',      'light_meter',  'Light meter',  60,  true,  null, 6),
  ('octo-item-shoulder-bag',  'octo_item',      'shoulder_bag', 'Shoulder bag', 100, true,  null, 7),
  ('octo-item-skateboard',    'octo_item',      'skateboard',   'Skateboard',   100, true,  null, 8),
  ('octo-pet-merlin',         'octo_pet',       'merlin',       'Merlin',       150, false, 'Legendary · find it in a clam', 0),
  ('octo-pet-susie',          'octo_pet',       'susie',        'Susie',        150, false, 'Legendary · find it in a clam', 1),
  ('octo-pet-scarlet',        'octo_pet',       'scarlet',      'Scarlet',      150, false, 'Legendary · find it in a clam', 2)
on conflict (id) do update set
  label = excluded.label,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  sort_order = excluded.sort_order;

update public.shop_items i
set rarity = r.rarity
from (values
  ('octo-acc-bowtie',        'common'),
  ('octo-acc-glasses',       'common'),
  ('octo-acc-bucket-hat',    'uncommon'),
  ('octo-acc-beret',         'uncommon'),
  ('octo-acc-top-hat',       'rare'),
  ('octo-acc-cat-ears',      'rare'),
  ('octo-acc-sombrero',      'rare'),
  ('octo-acc-crown',         'epic'),
  ('octo-item-film-roll',    'common'),
  ('octo-item-coffee',       'common'),
  ('octo-item-camera',       'uncommon'),
  ('octo-item-polaroid',     'uncommon'),
  ('octo-item-sword',        'uncommon'),
  ('octo-item-flash',        'rare'),
  ('octo-item-light-meter',  'rare'),
  ('octo-item-shoulder-bag', 'epic'),
  ('octo-item-skateboard',   'epic'),
  ('octo-pet-merlin',        'legendary'),
  ('octo-pet-susie',         'legendary'),
  ('octo-pet-scarlet',       'legendary')
) as r(id, rarity)
where i.id = r.id;

-- Prices follow rarity, and every accessory, item and pet goes in the clam
update public.shop_items
set price = case rarity
              when 'common' then 20 when 'uncommon' then 40 when 'rare' then 60
              when 'epic' then 100 else 150
            end,
    in_blind_box = true
where category in ('octo_accessory', 'octo_item', 'octo_pet')
  and not (price = 0 and is_purchasable); -- free starters stay free

------------------------------------------------------------------------------
-- Equipping a pet needs to own it, like the other octopus slots
------------------------------------------------------------------------------
create or replace function public.guard_octopus_write()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.updated_at := now();

  if new.color is distinct from old.color
     and not public.owns_cosmetic(new.user_id, 'octo_color', new.color) then
    raise exception 'You don''t own that color';
  end if;
  if new.accessory is distinct from old.accessory and new.accessory is not null
     and not public.owns_cosmetic(new.user_id, 'octo_accessory', new.accessory) then
    raise exception 'You don''t own that accessory';
  end if;
  if new.held_item is distinct from old.held_item and new.held_item is not null
     and not public.owns_cosmetic(new.user_id, 'octo_item', new.held_item) then
    raise exception 'You don''t own that item';
  end if;
  if new.pet is distinct from old.pet and new.pet is not null
     and not public.owns_cosmetic(new.user_id, 'octo_pet', new.pet) then
    raise exception 'You don''t have that sidekick';
  end if;
  if new.dialogue is distinct from old.dialogue
     and not public.owns_cosmetic(new.user_id, 'octo_dialogue', new.dialogue) then
    raise exception 'You don''t own that line';
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------
-- Duplicates from the clam, waiting to be sold back
------------------------------------------------------------------------------
create table if not exists public.blind_box_duplicates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  created_at timestamptz not null default now()
);

alter table public.blind_box_duplicates enable row level security;
drop policy if exists "read own duplicates" on public.blind_box_duplicates;
create policy "read own duplicates" on public.blind_box_duplicates for select using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- Open a blind box: 2 pulls. Each pull rolls a rarity by weight (only tiers
-- that have items count), then an item evenly within it. Anything you
-- already own, or already pulled from this clam, comes out as a duplicate.
-- Returns { balance, picks: [{ item_id, duplicate_id }] }, duplicate_id
-- null for new finds.
------------------------------------------------------------------------------
drop function if exists public.open_blind_box(text);
create function public.open_blind_box(p_box_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  box shop_items;
  new_balance int;
  per_box constant int := 2;
  tier text;
  pick text;
  dup_id uuid;
  picks json[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into box from shop_items where id = p_box_id and category = 'blind_box' and is_purchasable;
  if not found then
    raise exception 'That blind box isn''t available';
  end if;

  update profiles
  set currency_balance = currency_balance - box.price
  where id = auth.uid() and currency_balance >= box.price
  returning currency_balance into new_balance;

  if not found then
    raise exception 'Not enough shutters';
  end if;

  for n in 1..per_box loop
    -- Weighted pick of a tier: the smallest -ln(u)/weight wins with
    -- probability weight / total
    select r.id into tier
    from rarities r
    where exists (
      select 1 from shop_items i
      where i.rarity = r.id and i.in_blind_box
        and i.category in ('octo_accessory', 'octo_item', 'octo_pet')
    )
    order by -ln(1 - random()) / r.weight
    limit 1;

    if tier is null then
      raise exception 'This clam is empty';
    end if;

    select i.id into pick
    from shop_items i
    where i.rarity = tier and i.in_blind_box
      and i.category in ('octo_accessory', 'octo_item', 'octo_pet')
    order by random()
    limit 1;

    dup_id := null;
    if exists (select 1 from user_inventory where user_id = auth.uid() and item_id = pick) then
      insert into blind_box_duplicates (user_id, item_id) values (auth.uid(), pick)
      returning id into dup_id;
    else
      insert into user_inventory (user_id, item_id) values (auth.uid(), pick);
    end if;

    picks := picks || json_build_object('item_id', pick, 'duplicate_id', dup_id);
  end loop;

  return json_build_object('balance', new_balance, 'picks', to_json(picks));
end;
$$;

------------------------------------------------------------------------------
-- Sell a duplicate back for half the item's price (rounded down)
------------------------------------------------------------------------------
create or replace function public.sell_duplicate(p_duplicate_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sold_item text;
  refund int;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from blind_box_duplicates
  where id = p_duplicate_id and user_id = auth.uid()
  returning item_id into sold_item;

  if sold_item is null then
    raise exception 'That duplicate was already sold';
  end if;

  select price / 2 into refund from shop_items where id = sold_item;

  update profiles
  set currency_balance = currency_balance + refund
  where id = auth.uid()
  returning currency_balance into new_balance;

  return json_build_object('balance', new_balance, 'refund', refund);
end;
$$;

revoke all on function public.open_blind_box(text) from public, anon;
revoke all on function public.sell_duplicate(uuid) from public, anon;
grant execute on function public.open_blind_box(text) to authenticated;
grant execute on function public.sell_duplicate(uuid) to authenticated;

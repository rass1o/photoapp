-- Octopus mascot, film-stock stamps, and theme suggestion tickets.
-- Run after 20261027_payouts_and_shop.sql, in the Supabase SQL Editor.
-- Safe to re-run.

------------------------------------------------------------------------------
-- Shop catalog: new categories + an accent color for stamps
------------------------------------------------------------------------------

alter table public.shop_items add column if not exists accent text;

alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check check (
  category in ('frame', 'banner', 'badge', 'stamp', 'octo_color', 'octo_accessory', 'octo_item', 'octo_dialogue', 'ticket')
);

-- For octo_dialogue, `label` is the line itself; {name} is swapped for the octopus's name.
insert into public.shop_items (id, category, value, label, price, is_purchasable, accent, sort_order) values
  ('stamp-portra-400',  'stamp', 'Portra 400',     'Portra 400',     15, true, '#f59e0b', 0),
  ('stamp-gold-200',    'stamp', 'Gold 200',       'Gold 200',       15, true, '#eab308', 1),
  ('stamp-ektar-100',   'stamp', 'Ektar 100',      'Ektar 100',      20, true, '#ef4444', 2),
  ('stamp-superia-400', 'stamp', 'Superia 400',    'Superia 400',    15, true, '#16a34a', 3),
  ('stamp-velvia-50',   'stamp', 'Velvia 50',      'Velvia 50',      20, true, '#0f766e', 4),
  ('stamp-tri-x-400',   'stamp', 'Tri-X 400',      'Tri-X 400',      15, true, '#111827', 5),
  ('stamp-hp5-plus',    'stamp', 'HP5 Plus',       'HP5 Plus',       15, true, '#4b5563', 6),
  ('stamp-cinestill',   'stamp', 'CineStill 800T', 'CineStill 800T', 25, true, '#dc2626', 7),

  ('octo-color-lilac',     'octo_color', '#a78bfa', 'Lilac',     0,  true, null, 0),
  ('octo-color-coral',     'octo_color', '#fb7185', 'Coral',     20, true, null, 1),
  ('octo-color-lagoon',    'octo_color', '#2dd4bf', 'Lagoon',    20, true, null, 2),
  ('octo-color-ocean',     'octo_color', '#60a5fa', 'Ocean',     25, true, null, 3),
  ('octo-color-sunny',     'octo_color', '#fbbf24', 'Sunny',     25, true, null, 4),
  ('octo-color-bubblegum', 'octo_color', '#f472b6', 'Bubblegum', 30, true, null, 5),
  ('octo-color-deep-sea',  'octo_color', '#64748b', 'Deep sea',  40, true, null, 6),

  ('octo-acc-bowtie',     'octo_accessory', 'bowtie',        'Bow tie',       20, true, null, 0),
  ('octo-acc-glasses',    'octo_accessory', 'round_glasses', 'Round glasses', 25, true, null, 1),
  ('octo-acc-bucket-hat', 'octo_accessory', 'bucket_hat',    'Bucket hat',    25, true, null, 2),
  ('octo-acc-beret',      'octo_accessory', 'beret',         'Beret',         30, true, null, 3),
  ('octo-acc-top-hat',    'octo_accessory', 'top_hat',       'Top hat',       40, true, null, 4),
  ('octo-acc-crown',      'octo_accessory', 'crown',         'Crown',         75, true, null, 5),

  ('octo-item-film-roll', 'octo_item', 'film_roll', 'Film roll', 20, true, null, 0),
  ('octo-item-coffee',    'octo_item', 'coffee',    'Coffee',    20, true, null, 1),
  ('octo-item-camera',    'octo_item', 'camera',    'Camera',    30, true, null, 2),
  ('octo-item-polaroid',  'octo_item', 'polaroid',  'Polaroid',  30, true, null, 3),
  ('octo-item-flash',     'octo_item', 'flash',     'Flash',     35, true, null, 4),

  ('octo-line-hello',   'octo_dialogue', 'hello',   'Hi! I''m {name}.',                 0,  true, null, 0),
  ('octo-line-golden',  'octo_dialogue', 'golden',  'Golden hour waits for no one.',    10, true, null, 1),
  ('octo-line-bracket', 'octo_dialogue', 'bracket', 'Did you bracket that shot?',       10, true, null, 2),
  ('octo-line-film',    'octo_dialogue', 'film',    'Got any spare film?',              10, true, null, 3),
  ('octo-line-arms',    'octo_dialogue', 'arms',    'Eight arms, zero blurry photos.',  15, true, null, 4),
  ('octo-line-focus',   'octo_dialogue', 'focus',   'Shoot first, focus later.',        15, true, null, 5),
  ('octo-line-ink',     'octo_dialogue', 'ink',     'I only shoot ink and white.',      15, true, null, 6),

  ('ticket-theme-suggestion', 'ticket', 'theme_suggestion', 'Theme suggestion ticket', 30, true, null, 0)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  accent = excluded.accent,
  sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Octopus: one per user, created automatically
------------------------------------------------------------------------------

create table if not exists public.octopuses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default 'Inky' check (char_length(btrim(name)) between 1 and 20),
  color text not null default '#a78bfa',
  accessory text,  -- null = none
  held_item text,  -- null = none
  dialogue text not null default 'hello',
  updated_at timestamptz not null default now()
);

alter table public.octopuses enable row level security;

drop policy if exists "octopuses are public" on public.octopuses;
create policy "octopuses are public" on public.octopuses for select using (true);

drop policy if exists "update own octopus" on public.octopuses;
create policy "update own octopus" on public.octopuses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.octopuses (user_id) select id from public.profiles on conflict do nothing;

create or replace function public.create_octopus_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into octopuses (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists create_octopus_for_profile on public.profiles;
create trigger create_octopus_for_profile
after insert on public.profiles
for each row execute function public.create_octopus_for_profile();

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
  if new.dialogue is distinct from old.dialogue
     and not public.owns_cosmetic(new.user_id, 'octo_dialogue', new.dialogue) then
    raise exception 'You don''t own that line';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_octopus_write on public.octopuses;
create trigger guard_octopus_write
before update on public.octopuses
for each row execute function public.guard_octopus_write();

------------------------------------------------------------------------------
-- Film-stock stamps: chosen per film submission, must be owned
------------------------------------------------------------------------------

alter table public.submissions add column if not exists film_stamp text;

create or replace function public.guard_submission_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.film_stamp is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.film_stamp is not distinct from old.film_stamp then
    return new;
  end if;

  if new.format <> 'film' then
    raise exception 'Stamps can only go on film photos';
  end if;
  if not public.owns_cosmetic(new.user_id, 'stamp', new.film_stamp) then
    raise exception 'You don''t own that stamp';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_submission_stamp on public.submissions;
create trigger guard_submission_stamp
before insert or update on public.submissions
for each row execute function public.guard_submission_stamp();

------------------------------------------------------------------------------
-- Theme suggestions: spending a ticket submits one suggestion
------------------------------------------------------------------------------

-- status is set by hand from the dashboard: pending -> approved / declined
create table if not exists public.theme_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 40),
  description text check (description is null or char_length(description) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  price_paid int not null,
  created_at timestamptz not null default now()
);

alter table public.theme_suggestions enable row level security;

drop policy if exists "read own suggestions" on public.theme_suggestions;
create policy "read own suggestions" on public.theme_suggestions for select using (auth.uid() = user_id);

-- Charges the ticket price and records the suggestion in one transaction.
-- Returns the new balance.
create or replace function public.submit_theme_suggestion(p_title text, p_description text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_price int;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select price into ticket_price from shop_items where id = 'ticket-theme-suggestion' and is_purchasable;
  if ticket_price is null then
    raise exception 'Theme tickets aren''t available right now';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'Give your theme a name';
  end if;

  update profiles
  set currency_balance = currency_balance - ticket_price
  where id = auth.uid() and currency_balance >= ticket_price
  returning currency_balance into new_balance;

  if not found then
    raise exception 'Not enough shutters';
  end if;

  insert into theme_suggestions (user_id, title, description, price_paid)
  values (auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), ticket_price);

  return new_balance;
end;
$$;

revoke execute on function public.submit_theme_suggestion(text, text) from public, anon;
grant execute on function public.submit_theme_suggestion(text, text) to authenticated;

------------------------------------------------------------------------------
-- purchase_item: same as before, but tickets are spent via
-- submit_theme_suggestion and can't be bought into inventory
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
  if not found or not item.is_purchasable or item.category = 'ticket' then
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

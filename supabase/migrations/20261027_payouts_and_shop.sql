-- Weekly payouts + shop.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: tables/policies/functions are created idempotently.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

-- Everything a profile can equip. `value` is what gets written to the profile
-- column (a hex color for frames/banners, an Ionicons name for badges).
-- price 0 + is_purchasable = free starter everyone owns.
-- is_purchasable false = earned only (granted by process_due_payouts).
create table if not exists public.shop_items (
  id text primary key,
  category text not null check (category in ('frame', 'banner', 'badge')),
  value text not null,
  label text not null,
  price int not null default 0 check (price >= 0),
  is_purchasable boolean not null default true,
  unlock_hint text,
  sort_order int not null default 0,
  unique (category, value)
);

create table if not exists public.user_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- One row per podium finisher. Ties share a place (1, 1, 3 ranking), so a
-- format can have more than three rows.
create table if not exists public.theme_results (
  theme_id text not null,
  format text not null,
  place int not null check (place between 1 and 3),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null,
  vote_count int not null,
  reward int not null,
  primary key (theme_id, submission_id)
);

alter table public.shop_items enable row level security;
alter table public.user_inventory enable row level security;
alter table public.theme_results enable row level security;

drop policy if exists "shop items are public" on public.shop_items;
create policy "shop items are public" on public.shop_items for select using (true);

drop policy if exists "read own inventory" on public.user_inventory;
create policy "read own inventory" on public.user_inventory for select using (auth.uid() = user_id);

drop policy if exists "results are public" on public.theme_results;
create policy "results are public" on public.theme_results for select using (true);

-- No insert/update/delete policies on purpose: only the security definer
-- functions below can write to these tables.

------------------------------------------------------------------------------
-- Catalog
------------------------------------------------------------------------------

insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order) values
  ('frame-violet',  'frame', '#7c3aed', 'Violet',  0,  true, null, 0),
  ('frame-sky',     'frame', '#0ea5e9', 'Sky',     15, true, null, 1),
  ('frame-emerald', 'frame', '#10b981', 'Emerald', 15, true, null, 2),
  ('frame-red',     'frame', '#ef4444', 'Red',     20, true, null, 3),
  ('frame-amber',   'frame', '#f59e0b', 'Amber',   25, true, null, 4),
  ('frame-onyx',    'frame', '#111827', 'Onyx',    30, true, null, 5),
  ('frame-gold',    'frame', '#d4af37', 'Gold',    60, true, null, 6),

  ('banner-fog',      'banner', '#D9E2E6', 'Fog',      0,  true, null, 0),
  ('banner-peach',    'banner', '#FDE8D9', 'Peach',    20, true, null, 1),
  ('banner-lavender', 'banner', '#E4DFF7', 'Lavender', 20, true, null, 2),
  ('banner-mint',     'banner', '#DCEEE4', 'Mint',     20, true, null, 3),
  ('banner-butter',   'banner', '#FEF3C7', 'Butter',   25, true, null, 4),
  ('banner-ice',      'banner', '#E0F2FE', 'Ice',      25, true, null, 5),
  ('banner-blush',    'banner', '#FCE7F3', 'Blush',    30, true, null, 6),

  ('badge-streak',        'badge', 'flame-outline',    'streak',        0,  true,  null, 0),
  ('badge-aperture',      'badge', 'aperture-outline', 'aperture',      20, true,  null, 1),
  ('badge-film',          'badge', 'film-outline',     'film lover',    20, true,  null, 2),
  ('badge-golden-hour',   'badge', 'sunny-outline',    'golden hour',   25, true,  null, 3),
  ('badge-night-owl',     'badge', 'moon-outline',     'night owl',     25, true,  null, 4),
  ('badge-collector',     'badge', 'diamond-outline',  'collector',     75, true,  null, 5),
  ('badge-weekly-winner', 'badge', 'ribbon-outline',   'weekly winner', 0,  false, 'Take 1st place in a weekly theme', 10),
  ('badge-top-voter',     'badge', 'star-outline',     'top voter',     0,  false, 'Cast the most votes in a weekly theme', 11),
  ('badge-early-bird',    'badge', 'flash-outline',    'early bird',    0,  false, 'Submit within 24h of a theme starting', 12)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  sort_order = excluded.sort_order;

-- Let existing users keep whatever they already had equipped before the shop existed.
insert into public.user_inventory (user_id, item_id)
select p.id, i.id
from public.profiles p
join public.shop_items i
  on (i.category = 'frame' and i.value = p.avatar_frame_color)
  or (i.category = 'banner' and i.value = p.banner_color)
  or (i.category = 'badge' and i.value = p.badge)
on conflict do nothing;

------------------------------------------------------------------------------
-- Profile guard: the app can't edit balances/streaks or equip unowned items
------------------------------------------------------------------------------

create or replace function public.owns_cosmetic(p_user_id uuid, p_category text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from shop_items i
    where i.category = p_category
      and i.value = p_value
      and (
        (i.price = 0 and i.is_purchasable)
        or exists (select 1 from user_inventory u where u.user_id = p_user_id and u.item_id = i.id)
      )
  );
$$;

create or replace function public.guard_profile_write()
returns trigger
language plpgsql
as $$
begin
  -- Security definer functions run as the table owner and skip these checks.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.currency_balance := 0;
    new.streak_count := 0;
    new.daily_streak_count := 0;
    return new;
  end if;

  if new.currency_balance is distinct from old.currency_balance
     or new.streak_count is distinct from old.streak_count
     or new.daily_streak_count is distinct from old.daily_streak_count
     or new.last_daily_submission_date is distinct from old.last_daily_submission_date then
    raise exception 'Balances and streaks can only be changed by the server';
  end if;

  if new.avatar_frame_color is distinct from old.avatar_frame_color
     and not public.owns_cosmetic(new.id, 'frame', new.avatar_frame_color) then
    raise exception 'You don''t own that frame';
  end if;
  if new.banner_color is distinct from old.banner_color
     and not public.owns_cosmetic(new.id, 'banner', new.banner_color) then
    raise exception 'You don''t own that banner';
  end if;
  if new.badge is distinct from old.badge
     and not public.owns_cosmetic(new.id, 'badge', new.badge) then
    raise exception 'You don''t own that badge';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_write on public.profiles;
create trigger guard_profile_write
before insert or update on public.profiles
for each row execute function public.guard_profile_write();

------------------------------------------------------------------------------
-- Weekly payouts
------------------------------------------------------------------------------

-- Pays out every theme that has ended and hasn't been processed yet.
-- Each theme is handled in the same transaction as its results_processed
-- flag, so a theme is either fully paid or not touched at all, and
-- concurrent callers skip themes another caller is already processing.
create or replace function public.process_due_payouts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  processed int := 0;
begin
  for t in
    select id, start_date
    from themes
    where end_date < now() and not coalesce(results_processed, false)
    order by end_date
    for update skip locked
  loop
    -- Top 3 per format. rank() gives ties the same place and skips the next
    -- one (10, 10, 7 votes -> places 1, 1, 3). Photos need at least one vote.
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 20 when 2 then 10 else 5 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (partition by s.format order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 3
    on conflict do nothing;

    update profiles p
    set currency_balance = p.currency_balance + r.total
    from (
      select user_id, sum(reward) as total
      from theme_results
      where theme_id = t.id::text
      group by user_id
    ) r
    where p.id = r.user_id;

    -- Earned badges
    insert into user_inventory (user_id, item_id)
    select distinct user_id, 'badge-weekly-winner'
    from theme_results
    where theme_id = t.id::text and place = 1
    on conflict do nothing;

    insert into user_inventory (user_id, item_id)
    select distinct s.user_id, 'badge-early-bird'
    from submissions s
    where s.theme_id::text = t.id::text
      and s.created_at < t.start_date + interval '24 hours'
    on conflict do nothing;

    insert into user_inventory (user_id, item_id)
    select voter_id, 'badge-top-voter'
    from (
      select v.user_id as voter_id, rank() over (order by count(*) desc) as voter_rank
      from votes v
      join submissions s on s.id = v.submission_id
      where s.theme_id::text = t.id::text
      group by v.user_id
    ) voters
    where voter_rank = 1
    on conflict do nothing;

    update themes set results_processed = true where id = t.id;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

------------------------------------------------------------------------------
-- Shop purchases
------------------------------------------------------------------------------

-- Returns the buyer's new balance. Price comes from shop_items, never the app.
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
  if not found or not item.is_purchasable then
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

  -- If two purchases race, the second insert hits the primary key and the
  -- whole call rolls back, including the deduction above.
  insert into user_inventory (user_id, item_id) values (auth.uid(), p_item_id);

  return new_balance;
end;
$$;

------------------------------------------------------------------------------
-- Daily photo reward (moved off the client so balances stay server-only)
------------------------------------------------------------------------------

create or replace function public.record_daily_post(p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  prof record;
  next_streak int;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- Client dates are local-ish, so allow a day of slack either way.
  if abs(p_date - current_date) > 1 then
    raise exception 'Invalid date';
  end if;

  if not exists (
    select 1 from daily_submissions
    where user_id = auth.uid() and submission_date::date = p_date
  ) then
    raise exception 'No daily photo posted for that day';
  end if;

  select daily_streak_count, last_daily_submission_date::date as last_date, currency_balance
  into prof
  from profiles
  where id = auth.uid()
  for update;

  if prof.last_date = p_date then
    return json_build_object('streak', prof.daily_streak_count, 'balance', prof.currency_balance, 'reward', 0);
  end if;

  next_streak := case when prof.last_date = p_date - 1 then coalesce(prof.daily_streak_count, 0) + 1 else 1 end;

  update profiles
  set daily_streak_count = next_streak,
      last_daily_submission_date = p_date,
      currency_balance = currency_balance + 1
  where id = auth.uid()
  returning currency_balance into new_balance;

  return json_build_object('streak', next_streak, 'balance', new_balance, 'reward', 1);
end;
$$;

------------------------------------------------------------------------------
-- Permissions
------------------------------------------------------------------------------

revoke execute on function public.process_due_payouts() from public, anon;
revoke execute on function public.purchase_item(text) from public, anon;
revoke execute on function public.record_daily_post(date) from public, anon;
grant execute on function public.process_due_payouts() to authenticated;
grant execute on function public.purchase_item(text) to authenticated;
grant execute on function public.record_daily_post(date) to authenticated;

------------------------------------------------------------------------------
-- Optional: run payouts on a schedule so they don't depend on anyone opening
-- the app. Enable pg_cron first (Dashboard -> Database -> Extensions), then
-- run this line on its own:
--
--   select cron.schedule('process-theme-payouts', '*/15 * * * *', $$select public.process_due_payouts()$$);
------------------------------------------------------------------------------

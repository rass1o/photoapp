-- A second blind box (the pearl clam) for the new frames and banners, and
-- weekly voting by category on a dedicated voting day.
-- Run after 20261112_frames_banners_badges.sql.

------------------------------------------------------------------------------
-- Which blind box an item comes out of. The coral clam ('clam') keeps
-- Ocho's gear; the pearl clam ('pearl') holds the designed frames and banners.
------------------------------------------------------------------------------
alter table public.shop_items add column if not exists box text;

update public.shop_items
set box = 'clam'
where in_blind_box and category in ('octo_accessory', 'octo_item', 'octo_pet');

-- Frames and banners: only from the pearl clam now (anyone who already
-- bought a frame keeps it). Prices follow rarity, as in the coral clam, so
-- duplicates sell back for half.
update public.shop_items i
set rarity = r.rarity,
    price = case r.rarity when 'common' then 20 when 'uncommon' then 40 when 'rare' then 60 when 'epic' then 100 else 150 end,
    is_purchasable = false,
    in_blind_box = true,
    box = 'pearl',
    unlock_hint = 'Found in the pearl clam'
from (values
  ('frame-bubbles',      'common'),
  ('frame-starfish',     'common'),
  ('frame-cat-ears',     'uncommon'),
  ('frame-kelp',         'uncommon'),
  ('banner-island',      'uncommon'),
  ('frame-sombrero',     'rare'),
  ('frame-camera-top',   'rare'),
  ('frame-film-strip',   'rare'),
  ('banner-coral-reef',  'rare'),
  ('frame-tentacle-hug', 'epic'),
  ('frame-pearls',       'epic'),
  ('banner-shark',       'epic'),
  ('banner-whale',       'epic'),
  ('banner-sunset-sail', 'legendary')
) as r(id, rarity)
where i.id = r.id;

insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order)
values ('blind-box-pearl', 'blind_box', 'pearl', 'Pearl clam', 100, true, null, 1)
on conflict (id) do update set label = excluded.label, price = excluded.price, is_purchasable = excluded.is_purchasable;

------------------------------------------------------------------------------
-- open_blind_box: same as before, but pulls only from the box you opened
------------------------------------------------------------------------------
create or replace function public.open_blind_box(p_box_id text)
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
    select r.id into tier
    from rarities r
    where exists (
      select 1 from shop_items i
      where i.rarity = r.id and i.in_blind_box and i.box = box.value
    )
    order by -ln(1 - random()) / r.weight
    limit 1;

    if tier is null then
      raise exception 'This clam is empty';
    end if;

    select i.id into pick
    from shop_items i
    where i.rarity = tier and i.in_blind_box and i.box = box.value
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
-- Voting categories. Each person gets one vote per category per theme, plus
-- their one overall vote (still in the votes table, which drives vote_count
-- and the top-5 prizes).
------------------------------------------------------------------------------
create table if not exists public.vote_categories (
  id text primary key,
  label text not null,
  icon text not null,
  sort_order int not null default 0
);

alter table public.vote_categories enable row level security;
drop policy if exists "read vote categories" on public.vote_categories;
create policy "read vote categories" on public.vote_categories for select using (true);

insert into public.vote_categories (id, label, icon, sort_order) values
  ('dramatic',    'Most Dramatic',     'thunderstorm-outline',  1),
  ('creative',    'Most Creative',     'color-palette-outline', 2),
  ('light',       'Best Use of Light', 'sunny-outline',         3),
  ('composition', 'Best Composition',  'grid-outline',          4),
  ('story',       'Best Story',        'book-outline',          5)
on conflict (id) do update set label = excluded.label, icon = excluded.icon, sort_order = excluded.sort_order;

create table if not exists public.category_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  theme_id text not null,
  category text not null references public.vote_categories(id),
  created_at timestamptz not null default now(),
  unique (user_id, theme_id, category)
);

-- Anyone can see the tallies; votes are only cast through cast_vote()
alter table public.category_votes enable row level security;
drop policy if exists "read category votes" on public.category_votes;
create policy "read category votes" on public.category_votes for select using (true);

------------------------------------------------------------------------------
-- The schedule: submissions close a day before the theme ends, and that
-- last day is for voting only.
------------------------------------------------------------------------------
create or replace function public.theme_voting_opens(p_end timestamptz)
returns timestamptz
language sql
immutable
as $$
  select p_end - interval '1 day';
$$;

-- No new weekly photos once voting day starts
create or replace function public.guard_submission_window()
returns trigger
language plpgsql
as $$
declare
  ends timestamptz;
begin
  select end_date into ends from themes where id::text = new.theme_id::text;
  if ends is not null and now() >= theme_voting_opens(ends) then
    raise exception 'Submissions for this theme are closed: it''s voting day';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_submission_window on public.submissions;
create trigger guard_submission_window
before insert on public.submissions
for each row execute function public.guard_submission_window();

-- Overall votes: only on voting day, and one per person per theme. This
-- also covers older app versions that write to votes directly.
create or replace function public.guard_vote_rules()
returns trigger
language plpgsql
as $$
declare
  th themes;
begin
  select t.* into th
  from submissions s join themes t on t.id::text = s.theme_id::text
  where s.id = new.submission_id;

  if th.id is not null then
    if now() < theme_voting_opens(th.end_date) then
      raise exception 'Voting opens on the last day of the theme';
    end if;
    if now() >= th.end_date then
      raise exception 'Voting for this theme has closed';
    end if;
  end if;

  if exists (
    select 1 from votes v join submissions s on s.id = v.submission_id
    where v.user_id = new.user_id and s.theme_id::text = th.id::text
  ) then
    raise exception 'You''ve already used your overall vote this week';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_vote_rules on public.votes;
create trigger guard_vote_rules
before insert on public.votes
for each row execute function public.guard_vote_rules();

-- Cast (or move) a vote. p_category is 'overall' or a vote_categories id.
-- Voting for a new photo in a category you've already used moves that vote.
create or replace function public.cast_vote(p_submission uuid, p_category text default 'overall')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sub submissions;
  th themes;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select * into sub from submissions where id = p_submission;
  if not found then
    raise exception 'That photo is gone';
  end if;
  select * into th from themes where id::text = sub.theme_id::text;

  if sub.user_id = uid then
    raise exception 'You can''t vote for your own photo';
  end if;
  if now() < theme_voting_opens(th.end_date) then
    raise exception 'Voting opens on the last day of the theme';
  end if;
  if now() >= th.end_date then
    raise exception 'Voting for this theme has closed';
  end if;

  if p_category = 'overall' then
    if exists (select 1 from votes where user_id = uid and submission_id = p_submission) then
      return;
    end if;
    delete from votes v
    using submissions s
    where v.submission_id = s.id and v.user_id = uid and s.theme_id::text = th.id::text;
    insert into votes (user_id, submission_id) values (uid, p_submission);
  else
    if not exists (select 1 from vote_categories where id = p_category) then
      raise exception 'Unknown category';
    end if;
    delete from category_votes where user_id = uid and theme_id = th.id::text and category = p_category;
    insert into category_votes (user_id, submission_id, theme_id, category)
    values (uid, p_submission, th.id::text, p_category);
  end if;
end;
$$;

create or replace function public.remove_vote(p_submission uuid, p_category text default 'overall')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  th themes;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  select t.* into th
  from submissions s join themes t on t.id::text = s.theme_id::text
  where s.id = p_submission;
  if th.id is not null and now() >= th.end_date then
    raise exception 'Voting for this theme has closed';
  end if;

  if p_category = 'overall' then
    delete from votes where user_id = uid and submission_id = p_submission;
  else
    delete from category_votes where user_id = uid and submission_id = p_submission and category = p_category;
  end if;
end;
$$;

revoke all on function public.cast_vote(uuid, text) from public, anon;
revoke all on function public.remove_vote(uuid, text) from public, anon;
grant execute on function public.cast_vote(uuid, text) to authenticated;
grant execute on function public.remove_vote(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Category winners: one per category per theme (ties go to whoever posted
-- first), 50 shutters each, paid with the rest of the weekly prizes
------------------------------------------------------------------------------
create table if not exists public.theme_category_results (
  theme_id text not null,
  category text not null references public.vote_categories(id),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null,
  vote_count int not null,
  reward int not null,
  primary key (theme_id, category)
);

alter table public.theme_category_results enable row level security;
drop policy if exists "read category results" on public.theme_category_results;
create policy "read category results" on public.theme_category_results for select using (true);

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
    -- Top 5 overall (ties share a place: 10, 10, 7 votes -> 1, 1, 3)
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 200 when 2 then 175 when 3 then 150 when 4 then 75 else 50 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 5
    on conflict do nothing;

    -- One winner per category
    insert into theme_category_results (theme_id, category, submission_id, user_id, vote_count, reward)
    select distinct on (cv.category)
           t.id::text, cv.category, cv.submission_id, s.user_id, count(*)::int, 50
    from category_votes cv
    join submissions s on s.id = cv.submission_id
    where cv.theme_id = t.id::text
    group by cv.category, cv.submission_id, s.user_id, s.created_at
    order by cv.category, count(*) desc, s.created_at
    on conflict do nothing;

    update profiles p
    set currency_balance = p.currency_balance + r.total
    from (
      select user_id, sum(reward) as total
      from (
        select user_id, reward from theme_results where theme_id = t.id::text
        union all
        select user_id, reward from theme_category_results where theme_id = t.id::text
      ) all_prizes
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

    -- Skipped this theme: streak's over (unless already rebuilding one)
    update profiles p
    set streak_count = 0
    where coalesce(p.streak_count, 0) <> 0
      and not exists (
        select 1 from submissions s
        join themes th on th.id::text = s.theme_id::text
        where s.user_id = p.id and th.start_date >= t.start_date
      );

    update themes set results_processed = true where id = t.id;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

-- Everyone gets the same 6 votes now, so "most votes cast" no longer means much
update public.shop_items set unlock_hint = 'Retired' where id = 'badge-top-voter';

------------------------------------------------------------------------------
-- This week's early votes. Votes cast before this change didn't follow the
-- new rules (one overall vote, voting day only), so they're cleared for the
-- theme that's running now. Past themes aren't touched.
------------------------------------------------------------------------------
delete from public.votes v
using public.submissions s, public.themes t
where v.submission_id = s.id
  and t.id::text = s.theme_id::text
  and t.start_date <= now() and t.end_date > now();

update public.submissions s
set vote_count = (select count(*) from public.votes v where v.submission_id = s.id)
where s.vote_count <> (select count(*) from public.votes v where v.submission_id = s.id);

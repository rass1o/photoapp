-- More octopus colors, a feedback inbox for the Settings screen, and a way
-- for people to delete their own account. Run after
-- 20261107_more_sidekicks_and_items.sql.

------------------------------------------------------------------------------
-- Nine new colors for Ocho, bought in the Shop like the first seven
------------------------------------------------------------------------------
insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order) values
  ('octo-color-mint',      'octo_color', '#6ee7b7', 'Mint',      20, true, null, 7),
  ('octo-color-lime',      'octo_color', '#a3e635', 'Lime',      20, true, null, 8),
  ('octo-color-tangerine', 'octo_color', '#fb923c', 'Tangerine', 25, true, null, 9),
  ('octo-color-sky',       'octo_color', '#7dd3fc', 'Sky',       25, true, null, 10),
  ('octo-color-sandy',     'octo_color', '#e6c79c', 'Sandy',     25, true, null, 11),
  ('octo-color-ruby',      'octo_color', '#e11d48', 'Ruby',      30, true, null, 12),
  ('octo-color-plum',      'octo_color', '#9333ea', 'Plum',      35, true, null, 13),
  ('octo-color-charcoal',  'octo_color', '#4b5563', 'Charcoal',  40, true, null, 14),
  ('octo-color-gold',      'octo_color', '#d4a017', 'Gold',      60, true, null, 15)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Feedback and problem reports from Settings. Anyone signed in can send
-- one; nobody can read them from the app. Read them in the Table Editor.
------------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback', 'problem')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
drop policy if exists "send own feedback" on public.feedback;
create policy "send own feedback" on public.feedback for insert with check (auth.uid() = user_id);

------------------------------------------------------------------------------
-- Delete my account: removes everything the account made, then the login.
-- The base tables (posts, likes, comments, daily photos) don't cascade, so
-- they're cleared first in the right order; the rest go with the profile.
------------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- likes and comments other people left on this account's posts
  delete from votes where submission_id in (select id from submissions where user_id = uid);
  delete from comments where submission_id in (select id from submissions where user_id = uid);

  -- this account's own likes, comments, posts and daily photos
  delete from votes where user_id = uid;
  delete from comments where user_id = uid;
  delete from submissions where user_id = uid;
  delete from daily_submissions where user_id = uid;

  -- the profile (octopus, items, friends, notifications go with it), then the login
  delete from profiles where id = uid;
  delete from auth.users where id = uid;

  -- fix like counts on posts this account had liked
  update submissions s
  set vote_count = (select count(*) from votes v where v.submission_id = s.id)
  where s.vote_count <> (select count(*) from votes v where v.submission_id = s.id);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

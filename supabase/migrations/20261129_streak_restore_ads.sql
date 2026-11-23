-- Streak restore via rewarded ads.
-- Run after 20261128_new_rewards_clear_notifications.sql. Safe to re-run.

-- ============================================================================
-- Table: streak_restore_progress
-- ============================================================================
-- Each row is one verified ad watch from AdMob S2SV.
-- A restore session UUID groups up to 3 watches for one streak loss.

create table if not exists public.streak_restore_progress (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  streak_type     text not null check (streak_type in ('daily', 'weekly')),
  restore_session uuid not null,          -- client-generated UUID grouping watches for one loss
  admob_txn_id    text unique not null,    -- from S2SV callback, prevents replay
  verified_at     timestamptz not null default now()
);

create index if not exists idx_srp_user_session
  on public.streak_restore_progress (user_id, restore_session);

-- ============================================================================
-- Table: streak_restores (completed restores — audit log + rate limiter)
-- ============================================================================

create table if not exists public.streak_restores (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  streak_type     text not null check (streak_type in ('daily', 'weekly')),
  restore_session uuid not null unique,    -- one restore per session
  restored_at     timestamptz not null default now(),
  streak_value    int not null,            -- the streak count that was restored
  lost_at         timestamptz not null     -- when the streak was detected as lost
);

create index if not exists idx_sr_user_type
  on public.streak_restores (user_id, streak_type, restored_at);

-- RLS: users can read their own progress and restores.
-- Only the service_role (Edge Function) or security definer RPCs can write.

alter table public.streak_restore_progress enable row level security;
alter table public.streak_restores enable row level security;

drop policy if exists "Users can read their own restore progress" on public.streak_restore_progress;
create policy "Users can read their own restore progress"
  on public.streak_restore_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own restores" on public.streak_restores;
create policy "Users can read their own restores"
  on public.streak_restores for select
  using (auth.uid() = user_id);

-- ============================================================================
-- RPC: restore_streak
-- ============================================================================
-- Called by the client after 3 ads are verified. Double-checks everything
-- server-side before restoring the streak on the profiles table.

create or replace function public.restore_streak(
  p_streak_type text,
  p_restore_session uuid,
  p_lost_at timestamptz
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ads_required constant int := 3;
  restore_window constant interval := interval '24 hours';
  watched_count int;
  restored_value int;
begin
  -- Must be signed in
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- Validate streak type
  if p_streak_type not in ('daily', 'weekly') then
    raise exception 'Invalid streak type';
  end if;

  -- Check restore window: loss must be within 24 hours
  if now() - p_lost_at > restore_window then
    raise exception 'Restore window has expired (24 hours)';
  end if;

  -- Check no prior restore for this session
  if exists (
    select 1 from streak_restores
    where restore_session = p_restore_session
  ) then
    raise exception 'Streak already restored for this session';
  end if;

  -- Check no other restore for this user + streak type in the last 7 days
  if exists (
    select 1 from streak_restores
    where user_id = auth.uid()
      and streak_type = p_streak_type
      and restored_at > now() - interval '7 days'
  ) then
    raise exception 'Already restored this streak type recently';
  end if;

  -- Count verified ad watches for this session
  select count(*) into watched_count
  from streak_restore_progress
  where user_id = auth.uid()
    and restore_session = p_restore_session;

  if watched_count < ads_required then
    raise exception 'Not enough ads watched (% of % required)', watched_count, ads_required;
  end if;

  -- Determine the streak value to restore and update profiles
  if p_streak_type = 'daily' then
    select daily_streak_count into restored_value
    from profiles where id = auth.uid();

    -- Restore the daily streak: set last_daily_submission_date to yesterday
    -- so liveDailyStreak() considers it active, and today's post continues it
    update profiles
    set last_daily_submission_date = (current_date - 1)::text
    where id = auth.uid();
  else
    select streak_count into restored_value
    from profiles where id = auth.uid();
    -- Weekly streak: count is preserved during grace period and protected from reset
  end if;

  restored_value := coalesce(restored_value, 0);

  -- Record the completed restore
  insert into streak_restores (user_id, streak_type, restore_session, streak_value, lost_at)
  values (auth.uid(), p_streak_type, p_restore_session, restored_value, p_lost_at);

  return json_build_object(
    'restored', true,
    'streak_type', p_streak_type,
    'streak_value', restored_value
  );
end;
$$;

revoke execute on function public.restore_streak(text, uuid, timestamptz) from public, anon;
grant execute on function public.restore_streak(text, uuid, timestamptz) to authenticated;

-- ============================================================================
-- Update process_due_payouts() to respect weekly streak restore & grace window
-- ============================================================================

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
  -- Voting has opened: crown the most-liked photo (only likes from before
  -- voting count). Runs before the end-of-theme step below clears likes.
  for t in
    select id, end_date
    from themes
    where theme_voting_opens(end_date) <= now() and not most_liked_processed
    order by end_date
    for update skip locked
  loop
    with winner as (
      select s.id, s.user_id, count(l.id)::int as likes
      from submissions s
      join likes l on l.submission_id = s.id and l.created_at < theme_voting_opens(t.end_date)
      where s.theme_id::text = t.id::text
      group by s.id, s.user_id, s.created_at
      order by count(l.id) desc, s.created_at
      limit 1
    ), saved as (
      insert into theme_like_results (theme_id, submission_id, user_id, like_count, reward)
      select t.id::text, id, user_id, likes, 200 from winner
      on conflict do nothing
      returning user_id, reward
    )
    update profiles p set currency_balance = p.currency_balance + saved.reward
    from saved
    where p.id = saved.user_id;

    update themes set most_liked_processed = true where id = t.id;
  end loop;

  for t in
    select id, start_date, end_date
    from themes
    where end_date < now() and not coalesce(results_processed, false)
    order by end_date
    for update skip locked
  loop
    -- Top 3 overall by votes (ties share a place: 10, 10, 7 votes -> 1, 1, 3)
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 450 when 2 then 350 else 200 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 3
    on conflict do nothing;

    -- One winner per category (ties go to whoever posted first)
    insert into theme_category_results (theme_id, category, submission_id, user_id, vote_count, reward)
    select distinct on (cv.category)
           t.id::text, cv.category, cv.submission_id, s.user_id, count(*)::int, 150
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

    -- Skipped this theme: streak's over (unless already rebuilding one,
    -- restored via ads in the last 7 days, or still within the 24-hour restore window)
    if t.end_date < now() - interval '24 hours' then
      update profiles p
      set streak_count = 0
      where coalesce(p.streak_count, 0) <> 0
        and not exists (
          select 1 from submissions s
          join themes th on th.id::text = s.theme_id::text
          where s.user_id = p.id and th.start_date >= t.start_date
        )
        and not exists (
          select 1 from streak_restores sr
          where sr.user_id = p.id
            and sr.streak_type = 'weekly'
            and sr.restored_at > now() - interval '7 days'
        );
    end if;

    -- Fresh start: this theme's likes are cleared
    delete from likes l
    using submissions s
    where l.submission_id = s.id and s.theme_id::text = t.id::text;

    update themes set results_processed = true where id = t.id;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke execute on function public.process_due_payouts() from public, anon;
grant execute on function public.process_due_payouts() to authenticated;

-- ============================================================================
-- Update bump_weekly_streak() to continue streaks restored via ads
-- ============================================================================

create or replace function public.bump_weekly_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  this_start timestamptz;
  previous_theme text;
begin
  select start_date into this_start from themes where id::text = new.theme_id::text;

  select id::text into previous_theme
  from themes
  where start_date < this_start
  order by start_date desc
  limit 1;

  update profiles p
  set streak_count = case
    when (previous_theme is not null and exists (
      select 1 from submissions s
      where s.user_id = new.user_id and s.theme_id::text = previous_theme and s.id <> new.id
    )) or exists (
      select 1 from streak_restores sr
      where sr.user_id = new.user_id
        and sr.streak_type = 'weekly'
        and sr.restored_at > now() - interval '7 days'
    ) then coalesce(p.streak_count, 0) + 1
    else 1
  end
  where p.id = new.user_id;

  return new;
end;
$$;

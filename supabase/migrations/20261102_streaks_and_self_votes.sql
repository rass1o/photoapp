-- Weekly streaks that actually count, and no voting for your own photo.
-- Run after 20261101_blind_box.sql. Safe to re-run.

------------------------------------------------------------------------------
-- No self-votes
------------------------------------------------------------------------------
create or replace function public.block_self_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from submissions s where s.id = new.submission_id and s.user_id = new.user_id) then
    raise exception 'You can''t vote for your own photo';
  end if;
  return new;
end;
$$;

drop trigger if exists block_self_vote on public.votes;
create trigger block_self_vote
before insert on public.votes
for each row execute function public.block_self_vote();

-- Remove self-votes cast before this rule existed
delete from public.votes v
using public.submissions s
where s.id = v.submission_id and s.user_id = v.user_id;

-- Then recount any photo whose count is off (a separate statement, so it
-- sees the deletes; correct whether or not a trigger maintains vote_count)
update public.submissions s
set vote_count = c.actual
from (
  select s2.id, count(v.submission_id)::int as actual
  from public.submissions s2
  left join public.votes v on v.submission_id = s2.id
  group by s2.id
) c
where c.id = s.id and s.vote_count is distinct from c.actual;

------------------------------------------------------------------------------
-- Weekly streak: how many weekly themes in a row you've submitted to.
--   * Submitting counts right away: +1 if you also submitted to the theme
--     before this one, otherwise the streak restarts at 1.
--   * When a theme ends, anyone who skipped it (and hasn't already started
--     a new streak in a later theme) drops to 0.
------------------------------------------------------------------------------
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
    when previous_theme is not null and exists (
      select 1 from submissions s
      where s.user_id = new.user_id and s.theme_id::text = previous_theme and s.id <> new.id
    ) then coalesce(p.streak_count, 0) + 1
    else 1
  end
  where p.id = new.user_id;

  return new;
end;
$$;

drop trigger if exists bump_weekly_streak on public.submissions;
create trigger bump_weekly_streak
after insert on public.submissions
for each row execute function public.bump_weekly_streak();

-- process_due_payouts, as in 20261031_top5_payouts.sql, plus the streak reset
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
    -- Top 5 overall, any format (format is kept for display). rank() gives
    -- ties the same place and skips the next (10, 10, 7 votes -> 1, 1, 3).
    -- Photos need at least one vote.
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 50 when 2 then 40 when 3 then 30 when 4 then 20 else 15 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 5
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

------------------------------------------------------------------------------
-- Backfill everyone's streak from their history. Counts back from the most
-- recent theme; the theme that's still running only counts if you've
-- already submitted to it (not having submitted yet doesn't break a streak).
------------------------------------------------------------------------------
with started as (
  select id::text as theme_id,
         row_number() over (order by start_date desc) as recency,
         end_date > now() as running
  from public.themes
  where start_date <= now()
),
history as (
  select p.id as user_id, st.recency,
         exists (
           select 1 from public.submissions s
           where s.user_id = p.id and s.theme_id::text = st.theme_id
         ) as submitted,
         st.running
  from public.profiles p
  cross join started st
),
counted as (
  select user_id, submitted,
         row_number() over (partition by user_id order by recency) as position
  from history
  where submitted or not running
),
streaks as (
  select user_id,
         coalesce(min(position) filter (where not submitted) - 1, count(*))::int as streak
  from counted
  group by user_id
)
update public.profiles p
set streak_count = st.streak
from streaks st
where p.id = st.user_id and p.streak_count is distinct from st.streak;

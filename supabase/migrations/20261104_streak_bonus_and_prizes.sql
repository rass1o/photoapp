-- Bigger weekly prizes (200 / 175 / 150 / 75 / 50 for 1st-5th) and a
-- +20 shutter bonus every 5 days of daily streak.

------------------------------------------------------------------------------
-- Weekly payouts: same as 20261102_streaks_and_self_votes.sql, new amounts
------------------------------------------------------------------------------
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
           case ranked.place when 1 then 200 when 2 then 175 when 3 then 150 when 4 then 75 else 50 end
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
-- Daily photo reward: +1 shutter, plus 20 more on every 5th day in a row
-- (day 5, 10, 15, ...)
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
  bonus int;
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
    return json_build_object('streak', prof.daily_streak_count, 'balance', prof.currency_balance, 'reward', 0, 'bonus', 0);
  end if;

  next_streak := case when prof.last_date = p_date - 1 then coalesce(prof.daily_streak_count, 0) + 1 else 1 end;
  bonus := case when next_streak % 5 = 0 then 20 else 0 end;

  update profiles
  set daily_streak_count = next_streak,
      last_daily_submission_date = p_date,
      currency_balance = currency_balance + 1 + bonus
  where id = auth.uid()
  returning currency_balance into new_balance;

  return json_build_object('streak', next_streak, 'balance', new_balance, 'reward', 1 + bonus, 'bonus', bonus);
end;
$$;

revoke execute on function public.process_due_payouts() from public, anon;
revoke execute on function public.record_daily_post(date) from public, anon;
grant execute on function public.process_due_payouts() to authenticated;
grant execute on function public.record_daily_post(date) to authenticated;

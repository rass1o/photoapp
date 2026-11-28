-- Bringing back a lost streak for 200 shutters, as well as with ads.
-- Run after 20261129_streak_restore_ads.sql (it uses that file's
-- streak_restores table). Safe to re-run.
--
-- Same rules as the ad restore: only right after the streak broke, and one
-- restore per streak type every 7 days (ads and shutters share that limit).
-- Unlike the ad restore, the server checks for itself that the streak
-- really just broke, instead of trusting a time from the app:
--   * daily: the last daily photo was the day before yesterday, so only
--     yesterday was missed. p_today is the phone's date, like
--     record_daily_post takes, so it matches the day the phone shows.
--   * weekly: the last theme ended less than 24 hours ago, you didn't enter
--     it, and you'd entered the one before it.

create or replace function public.restore_streak_with_shutters(p_streak_type text, p_today date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  price constant int := 200;
  prof record;
  last_theme record;
  previous_theme text;
  restored_value int;
  lost timestamptz;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_streak_type not in ('daily', 'weekly') then
    raise exception 'Invalid streak type';
  end if;
  -- Phone dates are local, so allow a day of slack either way
  if abs(p_today - current_date) > 1 then
    raise exception 'Invalid date';
  end if;

  if exists (
    select 1 from streak_restores
    where user_id = auth.uid() and streak_type = p_streak_type and restored_at > now() - interval '7 days'
  ) then
    raise exception 'You already brought back a % streak this week', p_streak_type;
  end if;

  select streak_count, daily_streak_count, last_daily_submission_date::date as last_daily, currency_balance
  into prof from profiles where id = auth.uid() for update;

  if p_streak_type = 'daily' then
    if coalesce(prof.daily_streak_count, 0) < 2 or prof.last_daily is distinct from p_today - 2 then
      raise exception 'There''s no daily streak to bring back right now';
    end if;
    restored_value := prof.daily_streak_count;
    lost := p_today::timestamptz;
  else
    select id::text as id, start_date, end_date into last_theme
    from themes where end_date < now() order by end_date desc limit 1;
    select id::text into previous_theme
    from themes where last_theme.id is not null and start_date < last_theme.start_date
    order by start_date desc limit 1;
    if coalesce(prof.streak_count, 0) < 2
      or last_theme.id is null
      or now() - last_theme.end_date > interval '24 hours'
      or exists (select 1 from submissions where user_id = auth.uid() and theme_id::text = last_theme.id)
      or not exists (select 1 from submissions where user_id = auth.uid() and theme_id::text = previous_theme)
    then
      raise exception 'There''s no theme streak to bring back right now';
    end if;
    restored_value := prof.streak_count;
    lost := last_theme.end_date;
  end if;

  if coalesce(prof.currency_balance, 0) < price then
    raise exception 'You need % shutters to bring back your streak', price;
  end if;

  update profiles set currency_balance = currency_balance - price
  where id = auth.uid()
  returning currency_balance into new_balance;

  -- Daily: count yesterday as posted, so today's photo carries the streak on
  -- (a plain date, which fits the column whether it's stored as date or text)
  if p_streak_type = 'daily' then
    update profiles set last_daily_submission_date = p_today - 1 where id = auth.uid();
  end if;

  -- Weekly: this row is what stops the weekly reset and lets the next entry
  -- carry the streak on (see process_due_payouts and bump_weekly_streak)
  insert into streak_restores (user_id, streak_type, restore_session, streak_value, lost_at)
  values (auth.uid(), p_streak_type, gen_random_uuid(), restored_value, lost);

  return json_build_object('restored', true, 'streak_type', p_streak_type, 'streak_value', restored_value, 'balance', new_balance);
end;
$$;

revoke all on function public.restore_streak_with_shutters(text, date) from public, anon;
grant execute on function public.restore_streak_with_shutters(text, date) to authenticated;

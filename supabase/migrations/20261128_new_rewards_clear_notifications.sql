-- New shutter amounts, clam prices, and clearing notifications.
-- Run after 20261127_voting_shuffle.sql. Safe to re-run.
--
--   * Entering a weekly theme: 50 (was 150)
--   * Weekly top 3: 450 / 350 / 200 (was 750 / 500 / 300)
--   * Each category winner: 150 (was 500)
--   * Daily photo: still 25, plus 50 on every 5th day in a row (was 100)
--   * Both clams cost 150 (was 100)
--   * The most-liked photo when voting opens still wins 200
--   * People can delete their own notifications, one at a time or all at once
--
-- Shutters already paid stay as they are; the new amounts apply from now on.

------------------------------------------------------------------------------
-- Entering a weekly theme: 50 shutters, once per theme
------------------------------------------------------------------------------
create or replace function public.pay_theme_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into theme_entries (user_id, theme_id) values (new.user_id, new.theme_id::text)
  on conflict do nothing;
  if found then
    update profiles set currency_balance = currency_balance + 50 where id = new.user_id;
  end if;
  return new;
end;
$$;

------------------------------------------------------------------------------
-- Weekly payouts: top 3 overall win 450 / 350 / 200, each category winner
-- 150, the most-liked photo when voting opens 200. Same as
-- 20261116_goop_mand_most_liked.sql apart from the amounts.
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
    select id, start_date
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

    -- Skipped this theme: streak's over (unless already rebuilding one)
    update profiles p
    set streak_count = 0
    where coalesce(p.streak_count, 0) <> 0
      and not exists (
        select 1 from submissions s
        join themes th on th.id::text = s.theme_id::text
        where s.user_id = p.id and th.start_date >= t.start_date
      );

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

------------------------------------------------------------------------------
-- Daily photo: 25 shutters, plus 50 more on every 5th day in a row
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
  bonus := case when next_streak % 5 = 0 then 50 else 0 end;

  update profiles
  set daily_streak_count = next_streak,
      last_daily_submission_date = p_date,
      currency_balance = currency_balance + 25 + bonus
  where id = auth.uid()
  returning currency_balance into new_balance;

  return json_build_object('streak', next_streak, 'balance', new_balance, 'reward', 25 + bonus, 'bonus', bonus);
end;
$$;

------------------------------------------------------------------------------
-- Approved photo reviews pay the same daily amounts (same as
-- 20261126_groups.sql apart from the bonus)
------------------------------------------------------------------------------
create or replace function public.resolve_photo_review(p_id uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r photo_reviews%rowtype;
  d jsonb;
  posted_day date;
  prof record;
  next_streak int;
  bonus int;
  result text;
  message text;
begin
  select * into r from photo_reviews where id = p_id and status = 'pending' for update;
  if not found then
    return 'No pending review with that id';
  end if;
  d := r.details;

  if not p_approve then
    update photo_reviews set status = 'rejected', outcome = 'Kept blocked', reviewed_at = now() where id = p_id;
    insert into notifications (user_id, actor_id, type, body)
    values (r.user_id, r.user_id, 'report_update',
      'Ocho took a second look at the photo you asked about. It doesn''t fit our rules, so it stays off ShuttInk.');
    return 'Rejected. Delete the file in Storage -> submissions: ' || r.file_path;
  end if;

  if r.kind = 'weekly' then
    if exists (select 1 from submissions where user_id = r.user_id and theme_id = d->>'theme_id') then
      result := 'already entered this theme';
    elsif not exists (
      select 1 from themes where id::text = d->>'theme_id' and now() < end_date - interval '1 day'
    ) then
      result := 'theme is no longer taking entries';
    else
      -- the entry triggers pay the 50 and bump the weekly streak
      insert into submissions (user_id, theme_id, image_url, format, caption, film_strip)
      values (
        r.user_id,
        d->>'theme_id',
        r.image_url,
        coalesce(d->>'format', 'digital'),
        coalesce(d->>'caption', ''),
        coalesce((d->>'film_strip')::boolean, true)
      );
      result := 'posted';
    end if;

  elsif r.kind = 'daily' then
    posted_day := (d->>'date')::date;
    if exists (select 1 from daily_submissions where user_id = r.user_id and submission_date::date = posted_day) then
      result := 'already posted a daily photo that day';
    else
      insert into daily_submissions (user_id, image_url, submission_date)
      values (r.user_id, r.image_url, posted_day);

      -- Same streak and reward as record_daily_post, unless they've posted
      -- a later day since
      select daily_streak_count, last_daily_submission_date::date as last_date
      into prof from profiles where id = r.user_id for update;
      if prof.last_date is null or prof.last_date < posted_day then
        next_streak := case when prof.last_date = posted_day - 1 then coalesce(prof.daily_streak_count, 0) + 1 else 1 end;
        bonus := case when next_streak % 5 = 0 then 50 else 0 end;
        update profiles
        set daily_streak_count = next_streak,
            last_daily_submission_date = posted_day,
            currency_balance = currency_balance + 25 + bonus
        where id = r.user_id;
      end if;
      result := 'posted';
    end if;

  elsif r.kind = 'group' then
    if exists (
      select 1 from group_submissions where user_id = r.user_id and group_theme_id = (d->>'group_theme_id')::uuid
    ) then
      result := 'already posted to this group theme';
    elsif not exists (
      select 1
      from group_themes t
      join group_members m on m.group_id = t.group_id and m.user_id = r.user_id
      where t.id = (d->>'group_theme_id')::uuid and now() >= t.starts_at and now() < t.voting_at
    ) then
      result := 'the group theme is no longer taking photos';
    else
      insert into group_submissions (group_theme_id, group_id, user_id, image_url, format, caption, film_strip)
      select t.id, t.group_id, r.user_id, r.image_url,
             coalesce(d->>'format', 'digital'), coalesce(d->>'caption', ''), coalesce((d->>'film_strip')::boolean, true)
      from group_themes t
      where t.id = (d->>'group_theme_id')::uuid;
      result := 'posted';
    end if;

  elsif r.kind = 'avatar' then
    update profiles set avatar_url = r.image_url where id = r.user_id;
    result := 'posted';

  else
    update profiles set
      showcase_url_1 = case when d->>'slot' = '1' then r.image_url else showcase_url_1 end,
      showcase_url_2 = case when d->>'slot' = '2' then r.image_url else showcase_url_2 end,
      showcase_url_3 = case when d->>'slot' = '3' then r.image_url else showcase_url_3 end
    where id = r.user_id;
    result := 'posted';
  end if;

  message := case
    when result <> 'posted' then
      'Ocho took a second look at the photo you asked about, and it''s fine. It couldn''t be posted (' || result || '), but you''re welcome to use it next time.'
    when r.kind = 'weekly' then 'Ocho took a second look at your weekly photo, and it''s fine. It''s been entered in the theme.'
    when r.kind = 'daily' then 'Ocho took a second look at your daily photo, and it''s fine. It''s been posted.'
    when r.kind = 'group' then 'Ocho took a second look at your group photo, and it''s fine. It''s been posted to the group.'
    when r.kind = 'avatar' then 'Ocho took a second look at your profile photo, and it''s fine. It''s on your profile now.'
    else 'Ocho took a second look at your showcase photo, and it''s fine. It''s on your profile now.'
  end;

  update photo_reviews set status = 'approved', outcome = result, reviewed_at = now() where id = p_id;
  insert into notifications (user_id, actor_id, type, body) values (r.user_id, r.user_id, 'report_update', message);

  return 'Approved: ' || result;
end;
$$;

revoke all on function public.resolve_photo_review(uuid, boolean) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Clams: 150 shutters each
------------------------------------------------------------------------------
update public.shop_items set price = 150 where category = 'blind_box';

------------------------------------------------------------------------------
-- Clearing notifications: your own, one or all
------------------------------------------------------------------------------
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

grant delete on public.notifications to authenticated;

-- Asking for a second look at a photo the content filter blocked.
-- Run after 20261124_trim_frames_banners.sql. Safe to re-run.
--
-- How it works:
--   * When the filter blocks a photo, the app offers "Ask for a review". The
--     photo is saved to the person's own folder in the submissions bucket and
--     a row goes into public.photo_reviews with what it was for (weekly
--     entry, daily photo, avatar or showcase slot).
--   * Each person can have up to 3 reviews waiting at once.
--   * You review from the SQL Editor:
--       select * from public.photo_review_queue;
--       select public.resolve_photo_review('<review id>', true);   -- it's fine
--       select public.resolve_photo_review('<review id>', false);  -- keep it blocked
--     Approving posts the photo for them, the same way the app would have:
--     a weekly entry (if the theme is still taking entries), the daily
--     photo for the day they tried, their avatar, or a showcase slot. A
--     daily photo approved late still counts for that day; it only adds to
--     their streak if they haven't posted a later day since.
--     Either way they get a notification from Ocho.
--   * Rejecting doesn't delete the file (Storage files can't be deleted from
--     SQL). resolve_photo_review returns its path: delete it under Storage ->
--     submissions.

create table if not exists public.photo_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'daily', 'avatar', 'showcase')),
  image_url text not null,
  file_path text not null, -- inside the submissions bucket
  category text, -- what the filter thought it was: nudity, weapon, violence, gore, hate
  reason text, -- the message the filter showed them
  -- weekly: theme_id, format, caption, film_strip; daily: date; showcase: slot (1-3)
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  outcome text, -- what approving did, or why it couldn't
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists photo_reviews_pending_idx on public.photo_reviews (status, created_at);

alter table public.photo_reviews enable row level security;

-- Up to 3 waiting at once, so the queue can't be flooded
drop policy if exists "ask for a review as yourself" on public.photo_reviews;
create policy "ask for a review as yourself" on public.photo_reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and (select count(*) from public.photo_reviews r where r.user_id = auth.uid() and r.status = 'pending') < 3
  );

drop policy if exists "see your own reviews" on public.photo_reviews;
create policy "see your own reviews" on public.photo_reviews for select to authenticated
  using (user_id = auth.uid());

------------------------------------------------------------------------------
-- Reviewing (SQL Editor only; the app can't call these)
------------------------------------------------------------------------------
create or replace view public.photo_review_queue as
select
  r.id,
  p.username,
  r.kind,
  r.category,
  r.reason,
  r.image_url,
  r.details,
  r.created_at
from photo_reviews r
join profiles p on p.id = r.user_id
where r.status = 'pending'
order by r.created_at;

revoke all on public.photo_review_queue from public, anon, authenticated;

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
      -- the entry triggers pay the 150 and bump the weekly streak
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
        bonus := case when next_streak % 5 = 0 then 100 else 0 end;
        update profiles
        set daily_streak_count = next_streak,
            last_daily_submission_date = posted_day,
            currency_balance = currency_balance + 25 + bonus
        where id = r.user_id;
      end if;
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
    when r.kind = 'avatar' then 'Ocho took a second look at your profile photo, and it''s fine. It''s on your profile now.'
    else 'Ocho took a second look at your showcase photo, and it''s fine. It''s on your profile now.'
  end;

  update photo_reviews set status = 'approved', outcome = result, reviewed_at = now() where id = p_id;
  insert into notifications (user_id, actor_id, type, body) values (r.user_id, r.user_id, 'report_update', message);

  return 'Approved: ' || result;
end;
$$;

revoke all on function public.resolve_photo_review(uuid, boolean) from public, anon, authenticated;

-- Likes come back (any time during a theme, separate from voting), and the
-- prizes change: overall top 3 win 750 / 500 / 300, each category winner
-- 200, everyone who enters a weekly theme gets 150, and the daily photo pays
-- 25 with a 100 bonus every 5 days in a row. A theme's likes clear when it
-- ends. Run after 20261113_pearl_clam_and_category_voting.sql.

------------------------------------------------------------------------------
-- Likes
------------------------------------------------------------------------------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, submission_id)
);

create index if not exists likes_user_idx on public.likes (user_id, created_at desc);

alter table public.likes enable row level security;
drop policy if exists "read likes" on public.likes;
create policy "read likes" on public.likes for select using (true);
drop policy if exists "like as yourself" on public.likes;
create policy "like as yourself" on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "unlike your own likes" on public.likes;
create policy "unlike your own likes" on public.likes for delete using (auth.uid() = user_id);

alter table public.submissions add column if not exists like_count int not null default 0;

-- No liking your own photo, or one from a theme that's over
create or replace function public.guard_like()
returns trigger
language plpgsql
as $$
declare
  sub record;
begin
  select s.user_id, t.end_date into sub
  from submissions s left join themes t on t.id::text = s.theme_id::text
  where s.id = new.submission_id;
  if sub.user_id = new.user_id then
    raise exception 'You can''t like your own photo';
  end if;
  if sub.end_date is not null and now() >= sub.end_date then
    raise exception 'This theme has ended';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_like on public.likes;
create trigger guard_like
before insert on public.likes
for each row execute function public.guard_like();

-- Keep like_count in step, and tell the photographer (taken back on unlike)
create or replace function public.track_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    update submissions set like_count = like_count + 1 where id = new.submission_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into notifications (user_id, actor_id, type, submission_id)
      values (owner, new.user_id, 'like', new.submission_id);
    end if;
    return new;
  end if;

  update submissions set like_count = greatest(like_count - 1, 0) where id = old.submission_id;
  delete from notifications where type = 'like' and actor_id = old.user_id and submission_id = old.submission_id;
  return old;
end;
$$;

drop trigger if exists track_like on public.likes;
create trigger track_like
after insert or delete on public.likes
for each row execute function public.track_like();

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('vote', 'like', 'comment', 'friend_request', 'friend_accepted'));

------------------------------------------------------------------------------
-- 150 shutters for entering a weekly theme, once per theme even if a photo
-- is deleted and posted again
------------------------------------------------------------------------------
create table if not exists public.theme_entries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

alter table public.theme_entries enable row level security;

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
    update profiles set currency_balance = currency_balance + 150 where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pay_theme_entry on public.submissions;
create trigger pay_theme_entry
after insert on public.submissions
for each row execute function public.pay_theme_entry();

-- Past themes: just record who entered (no back pay)
insert into public.theme_entries (user_id, theme_id)
select distinct s.user_id, s.theme_id::text
from public.submissions s
join public.themes t on t.id::text = s.theme_id::text
where t.end_date <= now()
on conflict do nothing;

-- This week's theme: people who already entered get their 150 now
with paid as (
  insert into public.theme_entries (user_id, theme_id)
  select distinct s.user_id, s.theme_id::text
  from public.submissions s
  join public.themes t on t.id::text = s.theme_id::text
  where t.end_date > now()
  on conflict do nothing
  returning user_id
)
update public.profiles p
set currency_balance = p.currency_balance + 150
from paid
where p.id = paid.user_id;

------------------------------------------------------------------------------
-- Weekly payouts: top 3 overall win 750 / 500 / 300, each category winner
-- 200. Then the theme's likes are cleared for the next one.
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
    -- Top 3 overall by votes (ties share a place: 10, 10, 7 votes -> 1, 1, 3)
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 750 when 2 then 500 else 300 end
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
           t.id::text, cv.category, cv.submission_id, s.user_id, count(*)::int, 200
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
-- Daily photo: 25 shutters, plus 100 more on every 5th day in a row
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
  bonus := case when next_streak % 5 = 0 then 100 else 0 end;

  update profiles
  set daily_streak_count = next_streak,
      last_daily_submission_date = p_date,
      currency_balance = currency_balance + 25 + bonus
  where id = auth.uid()
  returning currency_balance into new_balance;

  return json_build_object('streak', next_streak, 'balance', new_balance, 'reward', 25 + bonus, 'bonus', bonus);
end;
$$;

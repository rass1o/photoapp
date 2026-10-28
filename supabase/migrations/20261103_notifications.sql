-- In-app notifications: likes, comments, friend requests, accepted requests.
-- Run after 20261102_streaks_and_self_votes.sql. Safe to re-run.
--
-- Rows are written only by the triggers below, so a notification can't be
-- faked from the app. Users can read their own and mark them read.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade, -- who it's for
  actor_id uuid not null references public.profiles(id) on delete cascade, -- who did it
  type text not null check (type in ('vote', 'comment', 'friend_request', 'friend_accepted')),
  submission_id uuid references public.submissions(id) on delete cascade,
  friendship_id uuid references public.friendships(id) on delete cascade,
  body text, -- comment preview
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);

-- Live unread badge (Realtime respects the select policy above)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

------------------------------------------------------------------------------
-- Likes
------------------------------------------------------------------------------
create or replace function public.notify_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into owner from submissions where id = new.submission_id;
    if owner is not null and owner <> new.user_id then
      insert into notifications (user_id, actor_id, type, submission_id)
      values (owner, new.user_id, 'vote', new.submission_id);
    end if;
    return new;
  end if;

  -- Un-liked: take the notification back
  delete from notifications
  where type = 'vote' and actor_id = old.user_id and submission_id = old.submission_id;
  return old;
end;
$$;

drop trigger if exists notify_vote on public.votes;
create trigger notify_vote
after insert or delete on public.votes
for each row execute function public.notify_vote();

------------------------------------------------------------------------------
-- Comments
------------------------------------------------------------------------------
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from submissions where id = new.submission_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, submission_id, body)
    values (owner, new.user_id, 'comment', new.submission_id, left(new.body, 120));
  end if;
  return new;
end;
$$;

drop trigger if exists notify_comment on public.comments;
create trigger notify_comment
after insert on public.comments
for each row execute function public.notify_comment();

------------------------------------------------------------------------------
-- Friend requests. Declined/cancelled requests delete the friendship row,
-- which removes its notification through the foreign key cascade.
------------------------------------------------------------------------------
create or replace function public.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (user_id, actor_id, type, friendship_id)
    values (new.addressee_id, new.requester_id, 'friend_request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    -- The request is answered, so it leaves the addressee's inbox...
    delete from notifications where type = 'friend_request' and friendship_id = new.id;
    -- ...and the requester hears the good news
    insert into notifications (user_id, actor_id, type, friendship_id)
    values (new.requester_id, new.addressee_id, 'friend_accepted', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_friendship on public.friendships;
create trigger notify_friendship
after insert or update on public.friendships
for each row execute function public.notify_friendship();

------------------------------------------------------------------------------
-- Mark read: pass ids, or nothing to mark everything read
------------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

------------------------------------------------------------------------------
-- Backfill (first run only): the last 30 days of likes and comments, already
-- marked read so nobody gets a flood of badges, plus pending friend requests
-- as unread.
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.notifications) then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, type, submission_id, created_at, read_at)
  select s.user_id, v.user_id, 'vote', v.submission_id, v.created_at, now()
  from public.votes v
  join public.submissions s on s.id = v.submission_id
  where s.user_id <> v.user_id and v.created_at > now() - interval '30 days';

  insert into public.notifications (user_id, actor_id, type, submission_id, body, created_at, read_at)
  select s.user_id, c.user_id, 'comment', c.submission_id, left(c.body, 120), c.created_at, now()
  from public.comments c
  join public.submissions s on s.id = c.submission_id
  where s.user_id <> c.user_id and c.created_at > now() - interval '30 days';

  insert into public.notifications (user_id, actor_id, type, friendship_id, created_at)
  select f.addressee_id, f.requester_id, 'friend_request', f.id, f.created_at
  from public.friendships f
  where f.status = 'pending';
end $$;

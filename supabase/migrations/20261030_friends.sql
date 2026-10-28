-- Friends: requests, accept/decline, friend counts, and live request popups.
-- Run after 20261029_ocho.sql. Safe to re-run.
--
-- One row per pair of users. It starts as 'pending' (requester asked
-- addressee) and becomes 'accepted'. Declining, cancelling and unfriending
-- delete the row. Clients can only read their own rows; every change goes
-- through the functions below.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- At most one row per pair, whichever direction the request went
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships readable by participants" on public.friendships;
create policy "friendships readable by participants"
  on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

-- Live friend request popups (Realtime respects the select policy above)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

------------------------------------------------------------------------------
-- Send a request. If they already asked you, this accepts theirs instead.
-- Returns the resulting status: 'pending' or 'accepted'.
------------------------------------------------------------------------------
create or replace function public.send_friend_request(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_user = me then raise exception 'You can''t add yourself as a friend'; end if;

  select * into existing
  from friendships
  where least(requester_id, addressee_id) = least(me, p_user)
    and greatest(requester_id, addressee_id) = greatest(me, p_user)
  for update;

  if found then
    if existing.status = 'pending' and existing.addressee_id = me then
      update friendships set status = 'accepted', responded_at = now() where id = existing.id;
      return 'accepted';
    end if;
    return existing.status;
  end if;

  insert into friendships (requester_id, addressee_id) values (me, p_user);
  return 'pending';
end;
$$;

------------------------------------------------------------------------------
-- Accept or decline a request sent to you. Declining deletes it.
------------------------------------------------------------------------------
create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  if p_accept then
    update friendships
    set status = 'accepted', responded_at = now()
    where id = p_request_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friendships
    where id = p_request_id and addressee_id = auth.uid() and status = 'pending';
  end if;

  if not found then raise exception 'That friend request is no longer there'; end if;
end;
$$;

------------------------------------------------------------------------------
-- Unfriend, or cancel a request you sent
------------------------------------------------------------------------------
create or replace function public.remove_friendship(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from friendships
  where least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
$$;

------------------------------------------------------------------------------
-- Anyone's friend count (rows themselves stay private)
------------------------------------------------------------------------------
create or replace function public.friend_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from friendships
  where status = 'accepted' and p_user in (requester_id, addressee_id);
$$;

revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
revoke all on function public.friend_count(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
grant execute on function public.friend_count(uuid) to authenticated;

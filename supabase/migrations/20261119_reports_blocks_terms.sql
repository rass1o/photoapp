-- Safety tools for the App Store: report photos, comments and accounts,
-- block accounts, and agree to the Terms of Use.
-- Run after 20261118_rename_manda.sql. Safe to re-run.
--
-- How it works:
--   * A report goes into public.reports. The person who reported a photo or
--     comment stops seeing it right away (the app covers it with Ocho).
--   * Once 3 different people report the same photo or comment, it's hidden
--     for everyone until it's reviewed (public.hidden_content).
--   * Account reports don't hide anything on their own, so a group can't
--     knock someone out by mass-reporting them. They wait for review.
--   * You review from the SQL Editor:
--       select * from public.moderation_queue;
--       select public.resolve_report('<target id>', true);   -- remove it
--       select public.resolve_report('<target id>', false);  -- it's fine
--     Removing a photo or comment deletes it; removing an account deletes
--     the account. Everyone who reported it gets a notification either way.
--   * Blocking hides the other person's photos, comments and notifications
--     from you, ends any friendship and stops new friend requests.

------------------------------------------------------------------------------
-- Reports
------------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('photo', 'daily', 'comment', 'account')),
  target_id uuid not null, -- the photo, daily photo, comment or account
  target_user_id uuid not null references public.profiles(id) on delete cascade, -- whose it is
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'nudity', 'violence', 'impersonation', 'underage', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, kind, target_id),
  check (reporter_id <> target_user_id)
);

create index if not exists reports_target_idx on public.reports (target_id, status);

alter table public.reports enable row level security;
drop policy if exists "report as yourself" on public.reports;
create policy "report as yourself" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "see your own reports" on public.reports;
create policy "see your own reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid());

------------------------------------------------------------------------------
-- Photos and comments hidden for everyone while they're reviewed
------------------------------------------------------------------------------
create table if not exists public.hidden_content (
  target_id uuid primary key,
  kind text not null,
  created_at timestamptz not null default now()
);

alter table public.hidden_content enable row level security;
drop policy if exists "anyone can see what's hidden" on public.hidden_content;
create policy "anyone can see what's hidden" on public.hidden_content for select using (true);

create or replace function public.hide_after_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'account' and (
    select count(distinct reporter_id) from reports where target_id = new.target_id and status = 'open'
  ) >= 3 then
    insert into hidden_content (target_id, kind) values (new.target_id, new.kind)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists hide_after_reports on public.reports;
create trigger hide_after_reports
after insert on public.reports
for each row execute function public.hide_after_reports();

------------------------------------------------------------------------------
-- Blocks
------------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
drop policy if exists "see who you blocked" on public.blocks;
create policy "see who you blocked" on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists "block as yourself" on public.blocks;
create policy "block as yourself" on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists "unblock as yourself" on public.blocks;
create policy "unblock as yourself" on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Blocking ends any friendship or pending request between the two
create or replace function public.end_friendship_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from friendships
  where least(requester_id, addressee_id) = least(new.blocker_id, new.blocked_id)
    and greatest(requester_id, addressee_id) = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

drop trigger if exists end_friendship_on_block on public.blocks;
create trigger end_friendship_on_block
after insert on public.blocks
for each row execute function public.end_friendship_on_block();

-- No friend requests between people when either has blocked the other
create or replace function public.guard_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from blocks
    where (blocker_id = new.requester_id and blocked_id = new.addressee_id)
       or (blocker_id = new.addressee_id and blocked_id = new.requester_id)
  ) then
    raise exception 'You can''t send a friend request to this account';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_blocked_friendship on public.friendships;
create trigger guard_blocked_friendship
before insert on public.friendships
for each row execute function public.guard_blocked_friendship();

-- Notifications from someone you blocked don't show up (or count as unread)
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select
  using (
    auth.uid() = user_id
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = actor_id)
  );

-- "Ocho finished looking at something you reported"
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('vote', 'like', 'comment', 'friend_request', 'friend_accepted', 'report_update'));

------------------------------------------------------------------------------
-- Terms of Use: when each account agreed to them
------------------------------------------------------------------------------
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set terms_accepted_at = now() where id = auth.uid();
$$;

revoke all on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated;

------------------------------------------------------------------------------
-- Reviewing reports (SQL Editor only; the app can't call these)
------------------------------------------------------------------------------
create or replace view public.moderation_queue as
select
  r.kind,
  r.target_id,
  owner.username as posted_by,
  count(*) as reports,
  string_agg(distinct r.reason, ', ') as reasons,
  string_agg(r.details, ' | ') filter (where r.details is not null) as details,
  coalesce(s.image_url, d.image_url) as image_url,
  c.body as comment,
  exists (select 1 from hidden_content h where h.target_id = r.target_id) as hidden_for_everyone,
  min(r.created_at) as first_reported
from reports r
join profiles owner on owner.id = r.target_user_id
left join submissions s on r.kind = 'photo' and s.id = r.target_id
left join daily_submissions d on r.kind = 'daily' and d.id = r.target_id
left join comments c on r.kind = 'comment' and c.id = r.target_id
where r.status = 'open'
group by r.kind, r.target_id, owner.username, s.image_url, d.image_url, c.body
order by count(*) desc, min(r.created_at);

revoke all on public.moderation_queue from public, anon, authenticated;

create or replace function public.resolve_report(p_target uuid, p_remove boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  message text;
begin
  select kind into k from reports where target_id = p_target and status = 'open' limit 1;
  if k is null then
    return 'No open reports for that id';
  end if;

  message := case
    when p_remove and k = 'account' then 'Ocho finished reviewing an account you reported. It broke our rules and has been removed. Thanks for looking out.'
    when p_remove and k = 'comment' then 'Ocho finished reviewing a comment you reported. It broke our rules and has been removed. Thanks for looking out.'
    when p_remove then 'Ocho finished reviewing a photo you reported. It broke our rules and has been removed. Thanks for looking out.'
    when k = 'account' then 'Ocho finished reviewing an account you reported. It didn''t break our rules, but you can always block them.'
    when k = 'comment' then 'Ocho finished reviewing a comment you reported. It didn''t break our rules, so it''s staying up.'
    else 'Ocho finished reviewing a photo you reported. It didn''t break our rules, so it''s back for everyone else. It stays covered for you.'
  end;

  -- Let everyone who reported it know (they're the "actor" so it shows as theirs)
  insert into notifications (user_id, actor_id, type, body)
  select distinct reporter_id, reporter_id, 'report_update', message
  from reports
  where target_id = p_target and status = 'open';

  update reports
  set status = case when p_remove then 'removed' else 'dismissed' end, reviewed_at = now()
  where target_id = p_target and status = 'open';

  delete from hidden_content where target_id = p_target;

  -- votes and comments don't cascade, so they're cleared first (like
  -- delete_my_account does)
  if p_remove then
    if k = 'photo' then
      delete from votes where submission_id = p_target;
      delete from comments where submission_id = p_target;
      delete from submissions where id = p_target;
    elsif k = 'daily' then
      delete from daily_submissions where id = p_target;
    elsif k = 'comment' then
      delete from comments where id = p_target;
    elsif k = 'account' then
      delete from votes where submission_id in (select id from submissions where user_id = p_target);
      delete from comments where submission_id in (select id from submissions where user_id = p_target);
      delete from votes where user_id = p_target;
      delete from comments where user_id = p_target;
      delete from submissions where user_id = p_target;
      delete from daily_submissions where user_id = p_target;
      delete from profiles where id = p_target;
      delete from auth.users where id = p_target;
    end if;
  end if;

  return case when p_remove then 'Removed' else 'Kept' end;
end;
$$;

revoke all on function public.resolve_report(uuid, boolean) from public, anon, authenticated;

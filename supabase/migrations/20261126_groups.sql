-- Groups: a private space with its own themes, like a photo class or a
-- group of friends. Run after 20261125_photo_reviews.sql. Safe to re-run.
--
-- How it works:
--   * Anyone can start a group. It gets a 6-character code to share; anyone
--     with the code can join. Members can also invite their friends from the
--     app, and the invite shows up in the friend's notifications.
--   * Only the person who started the group (the owner) sets its themes:
--     a name, an optional description, when it starts, when voting opens and
--     when it ends. Members (the owner too) post one photo per theme while
--     it's open, then get one vote each on voting day (not for their own).
--     When it ends, the group sees its top 3.
--   * Nothing in a group pays shutters, counts toward streaks or touches the
--     global rankings. Group photos only show to the group's members.
--   * The owner can remove members, remove any photo and delete the group.
--     Leaving a group (or being removed) takes your photos and votes with you.
--   * Group photos can be reported like any other photo, and photos the
--     content filter blocks can be sent for review (approved ones are posted
--     to the group if the theme is still open).

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- Pending invites; the row goes away once it's answered
create table if not exists public.group_invites (
  group_id uuid not null references public.groups(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, invitee_id)
);

create table if not exists public.group_themes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  starts_at timestamptz not null,
  voting_at timestamptz not null, -- photos close and voting opens
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (starts_at < voting_at and voting_at < ends_at)
);

create index if not exists group_themes_group_idx on public.group_themes (group_id, starts_at desc);

create table if not exists public.group_submissions (
  id uuid primary key default gen_random_uuid(),
  group_theme_id uuid not null references public.group_themes(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade, -- set from the theme
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  image_url text not null,
  format text not null default 'digital' check (format in ('digital', 'film')),
  caption text not null default '' check (char_length(caption) <= 300),
  film_strip boolean not null default true,
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_theme_id, user_id)
);

create index if not exists group_submissions_theme_idx on public.group_submissions (group_theme_id, created_at desc);

-- One vote per person per theme; changing it means deleting it first
create table if not exists public.group_votes (
  group_theme_id uuid not null references public.group_themes(id) on delete cascade,
  voter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.group_submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_theme_id, voter_id)
);

------------------------------------------------------------------------------
-- Who's in which group (security definer so policies can ask without
-- looping back through group_members' own policy)
------------------------------------------------------------------------------
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

create or replace function public.is_group_owner(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from groups where id = p_group and owner_id = auth.uid());
$$;

------------------------------------------------------------------------------
-- Policies. Groups, members and invites only change through the functions
-- further down.
------------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_themes enable row level security;
alter table public.group_submissions enable row level security;
alter table public.group_votes enable row level security;

-- Members see their groups; people invited see the group they're invited to
drop policy if exists "members and invitees see the group" on public.groups;
create policy "members and invitees see the group" on public.groups for select to authenticated
  using (
    public.is_group_member(id)
    or exists (select 1 from public.group_invites i where i.group_id = groups.id and i.invitee_id = auth.uid())
  );

drop policy if exists "members see each other" on public.group_members;
create policy "members see each other" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "see invites to you or your groups" on public.group_invites;
create policy "see invites to you or your groups" on public.group_invites for select to authenticated
  using (invitee_id = auth.uid() or public.is_group_member(group_id));

drop policy if exists "members see themes" on public.group_themes;
create policy "members see themes" on public.group_themes for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "owner adds themes" on public.group_themes;
create policy "owner adds themes" on public.group_themes for insert to authenticated
  with check (public.is_group_owner(group_id));
drop policy if exists "owner edits themes" on public.group_themes;
create policy "owner edits themes" on public.group_themes for update to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));
drop policy if exists "owner deletes themes" on public.group_themes;
create policy "owner deletes themes" on public.group_themes for delete to authenticated
  using (public.is_group_owner(group_id));

drop policy if exists "members see group photos" on public.group_submissions;
create policy "members see group photos" on public.group_submissions for select to authenticated
  using (public.is_group_member(group_id));
-- Posting: your own photo, in your group, while the theme takes photos
drop policy if exists "members post while the theme is open" on public.group_submissions;
create policy "members post while the theme is open" on public.group_submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and vote_count = 0
    and public.is_group_member(group_id)
    and exists (
      select 1 from public.group_themes t
      where t.id = group_theme_id and now() >= t.starts_at and now() < t.voting_at
    )
  );
-- Your own photo, or any photo in a group you own
drop policy if exists "delete your photo or as owner" on public.group_submissions;
create policy "delete your photo or as owner" on public.group_submissions for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

drop policy if exists "see your own group votes" on public.group_votes;
create policy "see your own group votes" on public.group_votes for select to authenticated
  using (voter_id = auth.uid());
-- Voting: during voting, for someone else's photo in that theme
drop policy if exists "vote during voting" on public.group_votes;
create policy "vote during voting" on public.group_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1
      from public.group_submissions s
      join public.group_themes t on t.id = s.group_theme_id
      where s.id = submission_id
        and s.group_theme_id = group_votes.group_theme_id
        and s.user_id <> auth.uid()
        and public.is_group_member(t.group_id)
        and now() >= t.voting_at and now() < t.ends_at
    )
  );
drop policy if exists "take back your vote during voting" on public.group_votes;
create policy "take back your vote during voting" on public.group_votes for delete to authenticated
  using (
    voter_id = auth.uid()
    and exists (
      select 1 from public.group_themes t
      where t.id = group_theme_id and now() >= t.voting_at and now() < t.ends_at
    )
  );

------------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------------
-- A photo belongs to its theme's group, whatever the app sends
create or replace function public.set_group_submission_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select group_id into new.group_id from group_themes where id = new.group_theme_id;
  return new;
end;
$$;

drop trigger if exists set_group_submission_group on public.group_submissions;
create trigger set_group_submission_group
before insert on public.group_submissions
for each row execute function public.set_group_submission_group();

-- Keep each photo's vote count in step with its votes
create or replace function public.count_group_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update group_submissions set vote_count = vote_count + 1 where id = new.submission_id;
  elsif tg_op = 'DELETE' then
    update group_submissions set vote_count = greatest(vote_count - 1, 0) where id = old.submission_id;
  end if;
  return null;
end;
$$;

drop trigger if exists count_group_votes on public.group_votes;
create trigger count_group_votes
after insert or delete on public.group_votes
for each row execute function public.count_group_votes();

-- Members hear about a new theme (the owner set it, so not them)
create or replace function public.notify_group_theme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  select id, name, owner_id into g from groups where id = new.group_id;
  insert into notifications (user_id, actor_id, type, body)
  select m.user_id, g.owner_id, 'group_theme', g.name || ': ' || new.name
  from group_members m
  where m.group_id = new.group_id and m.user_id <> g.owner_id;
  return new;
end;
$$;

drop trigger if exists notify_group_theme on public.group_themes;
create trigger notify_group_theme
after insert on public.group_themes
for each row execute function public.notify_group_theme();

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('vote', 'like', 'comment', 'reply', 'friend_request', 'friend_accepted', 'report_update', 'group_invite', 'group_theme'));

------------------------------------------------------------------------------
-- Starting, joining, inviting and leaving
------------------------------------------------------------------------------
create or replace function public.create_group(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O or 1/I
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'Group names are 1 to 40 characters';
  end if;
  if (select count(*) from groups where owner_id = auth.uid()) >= 10 then
    raise exception 'You can run up to 10 groups';
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from groups where invite_code = new_code);
  end loop;

  insert into groups (name, owner_id, invite_code) values (btrim(p_name), auth.uid(), new_code)
  returning id into new_id;
  insert into group_members (group_id, user_id) values (new_id, auth.uid());

  return json_build_object('id', new_id, 'name', btrim(p_name), 'invite_code', new_code);
end;
$$;

create or replace function public.join_group(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id, name into g from groups where invite_code = upper(btrim(p_code));
  if not found then
    raise exception 'No group has that code. Check it and try again.';
  end if;
  if (select count(*) from group_members where group_id = g.id) >= 300 then
    raise exception 'That group is full';
  end if;

  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  delete from group_invites where group_id = g.id and invitee_id = auth.uid();
  return json_build_object('id', g.id, 'name', g.name);
end;
$$;

-- Members can invite their friends
create or replace function public.invite_to_group(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  group_name text;
begin
  if not is_group_member(p_group) then
    raise exception 'You''re not in that group';
  end if;
  if not exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_user) or (requester_id = p_user and addressee_id = auth.uid()))
  ) then
    raise exception 'You can only invite your friends';
  end if;
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    return;
  end if;

  insert into group_invites (group_id, invitee_id, inviter_id) values (p_group, p_user, auth.uid())
  on conflict do nothing;
  if found then
    select name into group_name from groups where id = p_group;
    insert into notifications (user_id, actor_id, type, body) values (p_user, auth.uid(), 'group_invite', group_name);
  end if;
end;
$$;

create or replace function public.respond_group_invite(p_group uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_invites where group_id = p_group and invitee_id = auth.uid()) then
    raise exception 'That invite is no longer open';
  end if;
  if p_accept then
    insert into group_members (group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
  end if;
  delete from group_invites where group_id = p_group and invitee_id = auth.uid();
end;
$$;

-- Someone leaving takes their photos and votes in the group with them
create or replace function public.drop_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from group_votes
  where voter_id = p_user and group_theme_id in (select id from group_themes where group_id = p_group);
  delete from group_submissions where group_id = p_group and user_id = p_user;
  delete from group_members where group_id = p_group and user_id = p_user;
end;
$$;

revoke all on function public.drop_group_member(uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_group_owner(p_group) then
    raise exception 'You started this group, so you can delete it instead of leaving';
  end if;
  perform drop_group_member(p_group, auth.uid());
end;
$$;

create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_group_owner(p_group) then
    raise exception 'Only the group''s owner can remove people';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t remove yourself';
  end if;
  perform drop_group_member(p_group, p_user);
end;
$$;

create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_group_owner(p_group) then
    raise exception 'Only the group''s owner can delete it';
  end if;
  delete from groups where id = p_group;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.invite_to_group(uuid, uuid) from public, anon;
revoke all on function public.respond_group_invite(uuid, boolean) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.invite_to_group(uuid, uuid) to authenticated;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;

------------------------------------------------------------------------------
-- Reporting group photos (same review flow as other photos)
------------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('photo', 'daily', 'comment', 'account', 'group_photo'));

create or replace view public.moderation_queue as
select
  r.kind,
  r.target_id,
  owner.username as posted_by,
  count(*) as reports,
  string_agg(distinct r.reason, ', ') as reasons,
  string_agg(r.details, ' | ') filter (where r.details is not null) as details,
  coalesce(s.image_url, d.image_url, g.image_url) as image_url,
  c.body as comment,
  exists (select 1 from hidden_content h where h.target_id = r.target_id) as hidden_for_everyone,
  min(r.created_at) as first_reported
from reports r
join profiles owner on owner.id = r.target_user_id
left join submissions s on r.kind = 'photo' and s.id = r.target_id
left join daily_submissions d on r.kind = 'daily' and d.id = r.target_id
left join group_submissions g on r.kind = 'group_photo' and g.id = r.target_id
left join comments c on r.kind = 'comment' and c.id = r.target_id
where r.status = 'open'
group by r.kind, r.target_id, owner.username, s.image_url, d.image_url, g.image_url, c.body
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
    elsif k = 'group_photo' then
      delete from group_submissions where id = p_target; -- its votes go with it
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

------------------------------------------------------------------------------
-- Photo reviews for group photos (details: group_theme_id, format, caption,
-- film_strip). Same as 20261125, plus the 'group' branch.
------------------------------------------------------------------------------
alter table public.photo_reviews drop constraint if exists photo_reviews_kind_check;
alter table public.photo_reviews add constraint photo_reviews_kind_check
  check (kind in ('weekly', 'daily', 'avatar', 'showcase', 'group'));

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

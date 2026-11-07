-- Comment replies, deleting comments, and an on/off film strip per photo.
-- Run after 20261119_reports_blocks_terms.sql. Safe to re-run.

------------------------------------------------------------------------------
-- Film strip: Film photos show in a 35mm strip unless their owner turns it
-- off (chosen when posting, and changeable later)
------------------------------------------------------------------------------
alter table public.submissions add column if not exists film_strip boolean not null default true;

create or replace function public.set_film_strip(p_submission uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update submissions set film_strip = p_on where id = p_submission and user_id = auth.uid();
  if not found then
    raise exception 'You can only change your own photos';
  end if;
end;
$$;

revoke all on function public.set_film_strip(uuid, boolean) from public, anon;
grant execute on function public.set_film_strip(uuid, boolean) to authenticated;

------------------------------------------------------------------------------
-- Replies: a comment can answer another comment on the same photo. Threads
-- are one level deep, so a reply to a reply joins the same thread.
------------------------------------------------------------------------------
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

create or replace function public.guard_comment_reply()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select submission_id, parent_id into parent from comments where id = new.parent_id;
  if not found or parent.submission_id <> new.submission_id then
    raise exception 'That comment isn''t on this photo';
  end if;
  if parent.parent_id is not null then
    new.parent_id := parent.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_comment_reply on public.comments;
create trigger guard_comment_reply
before insert on public.comments
for each row execute function public.guard_comment_reply();

-- Notifications point at their comment, so deleting a comment takes its
-- notifications with it
alter table public.notifications add column if not exists comment_id uuid references public.comments(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('vote', 'like', 'comment', 'reply', 'friend_request', 'friend_accepted', 'report_update'));

-- The photographer hears about new comments; the person being replied to
-- hears about replies (once each, and never about their own)
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  replied_to uuid;
begin
  select user_id into owner from submissions where id = new.submission_id;
  if new.parent_id is not null then
    select user_id into replied_to from comments where id = new.parent_id;
  end if;

  if replied_to is not null and replied_to <> new.user_id then
    insert into notifications (user_id, actor_id, type, submission_id, comment_id, body)
    values (replied_to, new.user_id, 'reply', new.submission_id, new.id, left(new.body, 120));
  end if;

  if owner is not null and owner <> new.user_id and owner is distinct from replied_to then
    insert into notifications (user_id, actor_id, type, submission_id, comment_id, body)
    values (owner, new.user_id, 'comment', new.submission_id, new.id, left(new.body, 120));
  end if;
  return new;
end;
$$;

------------------------------------------------------------------------------
-- Deleting a comment: the person who wrote it, or the owner of the photo it's
-- on, can delete it. Its replies go with it.
------------------------------------------------------------------------------
create or replace function public.delete_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select cm.user_id, cm.submission_id, cm.body, s.user_id as owner
  into c
  from comments cm join submissions s on s.id = cm.submission_id
  where cm.id = p_comment;

  if not found then
    raise exception 'That comment is already gone';
  end if;
  if auth.uid() is null or auth.uid() not in (c.user_id, c.owner) then
    raise exception 'You can only delete your own comments, or comments on your photos';
  end if;

  -- notifications from before they were linked to their comment
  delete from notifications
  where type = 'comment' and comment_id is null
    and actor_id = c.user_id and submission_id = c.submission_id and body = left(c.body, 120);

  delete from comments where id = p_comment;
end;
$$;

revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

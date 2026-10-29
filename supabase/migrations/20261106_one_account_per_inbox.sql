-- One account per real inbox. Supabase already rejects the exact same email
-- twice, but these all reach the same Gmail inbox and count as different:
--   iworkatrito@gmail.com, i.work.at.rito@gmail.com, IWorkAtRito+2@googlemail.com
-- normalize_email() reduces them to one form, and a trigger on sign-up (or
-- email change) refuses any address whose form is already taken.

create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
as $$
  with parts as (
    select split_part(lower(btrim(p_email)), '@', 1) as local,
           split_part(lower(btrim(p_email)), '@', 2) as domain
  ),
  cleaned as (
    select
      -- "+anything" is a tag that still delivers to the same inbox
      split_part(local, '+', 1) as local,
      case when domain = 'googlemail.com' then 'gmail.com' else domain end as domain
    from parts
  )
  select case
           -- Gmail ignores dots in the name
           when domain = 'gmail.com' then replace(local, '.', '')
           else local
         end || '@' || domain
  from cleaned;
$$;

create or replace function public.block_duplicate_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;

  if exists (
    select 1 from auth.users u
    where u.id <> new.id
      and u.email is not null
      and public.normalize_email(u.email) = public.normalize_email(new.email)
  ) then
    -- The app matches this text to show a friendly message
    raise exception 'duplicate_inbox: an account already uses this email address';
  end if;

  return new;
end;
$$;

drop trigger if exists block_duplicate_inbox on auth.users;
create trigger block_duplicate_inbox
before insert or update of email on auth.users
for each row execute function public.block_duplicate_inbox();

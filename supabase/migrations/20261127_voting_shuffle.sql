-- Fair order on voting day. Run after 20261126_groups.sql. Safe to re-run.
--
-- The rest of the week, the Friends and Global feeds show the newest photos
-- first. On a weekly theme's voting day they call this instead: the theme's
-- photos in a shuffled order that's different for each person and stays the
-- same all day (new photos can't be entered then), a page at a time. Photos
-- posted early no longer end up at the bottom for everyone.
--
-- It runs as the person asking, so the usual rules on who sees what apply.
-- p_user_ids narrows it to some accounts (the Friends feed); null is
-- everyone.

create or replace function public.voting_feed(
  p_theme text,
  p_user_ids text[] default null,
  p_offset int default 0,
  p_limit int default 8
)
returns setof public.submissions
language sql
stable
set search_path = public
as $$
  select s.*
  from submissions s
  where s.theme_id::text = p_theme
    and (p_user_ids is null or s.user_id::text = any(p_user_ids))
  order by md5(auth.uid()::text || s.id::text)
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.voting_feed(text, text[], int, int) from public, anon;
grant execute on function public.voting_feed(text, text[], int, int) to authenticated;

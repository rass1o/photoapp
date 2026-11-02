-- Weekly themes that roll over on their own. theme_rotation is the order
-- themes come up in (it loops back to the top after the last one), and
-- ensure_current_theme() adds the next theme whenever none is running. The
-- app calls it before loading the theme, so a new week starts the first time
-- anyone opens the app. Themes run Monday to Monday, midnight Pacific.
-- Run after 20261109_delete_own_photos.sql.

create table if not exists public.theme_rotation (
  position int primary key,
  name text not null,
  recommended_films text
);

-- Only ensure_current_theme() reads it
alter table public.theme_rotation enable row level security;

insert into public.theme_rotation (position, name, recommended_films) values
  (1,  'Portraits',             'Kodak Portra 400, Fujifilm Pro 400H, Ilford HP5 Plus — shooting digital? use a wide aperture or portrait mode, and look for soft window light.'),
  (2,  'Landscapes',            'Kodak Ektar 100, Fujifilm Velvia 50, Kodak Portra 160 — shooting digital? keep the ISO low and use a narrow aperture so everything is sharp.'),
  (3,  'Long exposure',         'Ilford Pan F Plus 50, Kodak Ektar 100, Fujifilm Provia 100F — shooting digital? prop your phone steady and use night mode or a slow shutter.'),
  (4,  'Street',                'Kodak Tri-X 400, Ilford HP5 Plus, Kodak Gold 200 — shooting digital? use burst mode to catch the moment.'),
  (5,  'Close-up',              'Kodak Portra 160, Fujifilm Velvia 50, Kodak Ektar 100 — shooting digital? use macro mode or get as close as your lens will focus.'),
  (6,  'Reflections',           'Kodak Ektar 100, Kodak Portra 400, Ilford Delta 100 — puddles, windows and mirrors all count.'),
  (7,  'Silhouettes',           'Kodak Ektar 100, Fujifilm Velvia 50, Kodak Gold 200 — shoot toward the light and expose for the sky.'),
  (8,  'After dark',            'Kodak Portra 800, CineStill 800T, Ilford Delta 3200 — shooting digital? night mode and a steady hand go a long way.'),
  (9,  'Motion',                'Ilford HP5 Plus, Kodak Portra 400, Kodak Tri-X 400 — blur it with a slow shutter, or freeze it with a fast one.'),
  (10, 'Minimalism',            'Ilford Delta 100, Kodak Portra 160, Fujifilm Provia 100F — one subject, lots of empty space.'),
  (11, 'Patterns & textures',   'Ilford FP4 Plus, Kodak Ektar 100, Kodak T-Max 100 — get close and fill the frame.'),
  (12, 'Shadows',               'Kodak Tri-X 400, Ilford HP5 Plus, Kodak Gold 200 — hard midday or late-afternoon light makes the best shadows.'),
  (13, 'One color',             'Kodak Ektar 100, Fujifilm Velvia 50, Kodak Gold 200 — pick a color and build the whole photo around it.'),
  (14, 'Leading lines',         'Ilford FP4 Plus, Kodak Portra 400, Kodak Ektar 100 — roads, rails and fences that pull the eye in.'),
  (15, 'Water',                 'Fujifilm Velvia 50, Kodak Ektar 100, Ilford Pan F Plus 50 — try a slow shutter for silky water.'),
  (16, 'Animals',               'Kodak Portra 400, Kodak Gold 200, Ilford HP5 Plus — pets count! Get down to their eye level.'),
  (17, 'Architecture',          'Ilford Delta 100, Kodak Ektar 100, Kodak T-Max 100 — look up, and keep your lines straight.'),
  (18, 'Self-portrait',         'Kodak Portra 400, Ilford HP5 Plus, Fujifilm Pro 400H — use a timer, a mirror, or your shadow.'),
  (19, 'Frame within a frame',  'Kodak Portra 400, Ilford HP5 Plus, Kodak Ektar 100 — doorways, windows and arches make natural frames.'),
  (20, 'Golden hour',           'Kodak Portra 400, Kodak Gold 200, Kodak Ektar 100 — the hour after sunrise or before sunset.'),
  (21, 'Black and white',       'Kodak Tri-X 400, Ilford HP5 Plus, Fujifilm Neopan 400 — shooting digital? switch to monochrome mode or desaturate in post.')
on conflict (position) do update set
  name = excluded.name,
  recommended_films = excluded.recommended_films;

-- The Monday midnight (Pacific) that ends a theme starting at p_start.
-- Adding 3 days first means a theme that starts late in the week runs
-- through the following week instead of only a day or two (4 to 10 days).
create or replace function public.theme_end_for(p_start timestamptz)
returns timestamptz
language sql
stable
as $$
  select (date_trunc('week', (p_start + interval '3 days') at time zone 'America/Los_Angeles') + interval '7 days')
         at time zone 'America/Los_Angeles';
$$;

create or replace function public.ensure_current_theme()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_theme record;
  next_pos int;
  next_row theme_rotation;
  next_start timestamptz;
begin
  -- Only one caller at a time, so two people opening the app at once
  -- can't both add a theme
  perform pg_advisory_xact_lock(hashtext('ensure_current_theme'));

  if exists (select 1 from themes where start_date <= now() and end_date > now()) then
    return;
  end if;

  select name, end_date into last_theme from themes order by end_date desc limit 1;

  -- Next in the rotation after the last theme (back to the top after the end,
  -- or if the last theme isn't on the list)
  select coalesce(
           (select r.position from theme_rotation r where lower(r.name) = lower(last_theme.name) order by r.position limit 1),
           0
         ) % (select count(*) from theme_rotation) + 1
  into next_pos;

  select * into next_row from theme_rotation where position = next_pos;
  if not found then
    return; -- empty rotation: nothing to add
  end if;

  -- Pick up right where the last theme ended so weeks stay back to back,
  -- unless that's so long ago the new theme would already be over
  next_start := last_theme.end_date;
  if next_start is null or theme_end_for(next_start) <= now() then
    next_start := now();
  end if;

  insert into themes (name, start_date, end_date, recommended_films, results_processed)
  values (next_row.name, next_start, theme_end_for(next_start), next_row.recommended_films, false);
end;
$$;

revoke all on function public.ensure_current_theme() from public;
grant execute on function public.ensure_current_theme() to anon, authenticated;

------------------------------------------------------------------------------
-- This week: Portraits, starting the moment Black and white ends (or right
-- now if it already has), through Monday Nov 9 at midnight Pacific
------------------------------------------------------------------------------
insert into public.themes (name, start_date, end_date, recommended_films, results_processed)
select r.name,
       s.start_at,
       public.theme_end_for(s.start_at),
       r.recommended_films,
       false
from public.theme_rotation r
cross join (
  select greatest(now(), coalesce((select max(end_date) from public.themes), now())) as start_at
) s
where r.position = 1
  and not exists (select 1 from public.themes t where t.name = 'Portraits' and t.end_date > now());

select name, start_date, end_date from public.themes order by start_date desc limit 3;

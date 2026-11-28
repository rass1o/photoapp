-- A short overview of each weekly theme, shown when the theme starts in
-- place of the film suggestions, plus a place for each theme's example
-- photo. Run after 20261130_streak_restore_shutters.sql. Safe to re-run.
--
-- Where to edit them (Supabase dashboard -> Table Editor):
--   * theme_rotation: the list themes come from, in order. Its overview and
--     example_image_url are copied into each new week's theme when it starts.
--   * themes: the weeks that have started. Edit this week's row to change
--     what people see right now.
--
-- Example photos: upload them to Storage -> submissions -> theme-examples/
-- (the cleanup job never touches that folder), copy the file's URL, and
-- paste it into example_image_url.

alter table public.themes add column if not exists overview text;
alter table public.theme_rotation add column if not exists overview text;
alter table public.theme_rotation add column if not exists example_image_url text;

-- A theme about a photographer, as an example of the kind you can add
insert into public.theme_rotation (position, name, recommended_films)
values (22, 'Ansel Adams', 'Ilford HP5 Plus, Kodak Tri-X 400, Ilford Delta 100')
on conflict (position) do nothing;

update public.theme_rotation r set overview = v.overview
from (values
  ('Portraits', 'A portrait shows who someone is, not just what they look like. Get close, focus on the eyes, and look for soft light, like a window on a cloudy day. Candid moments often say more than a posed smile.'),
  ('Landscapes', 'Landscapes are about a sense of place: mountains, fields, coastlines, even a city skyline. Shoot early or late in the day when the light is low and warm, and put something interesting in the foreground to give the scene depth.'),
  ('Long exposure', 'Leaving the shutter open for a second or longer turns motion into streaks: car lights become ribbons, water turns to mist and clouds smear across the sky. Keep the camera completely still, using a tripod or a steady surface.'),
  ('Street', 'Street photography captures everyday life in public places, unposed and as it happens. Be patient, watch for gestures, light and moments that only last a second, and be respectful of the people you photograph.'),
  ('Close-up', 'Get closer than you normally would and show the small details people walk past: the texture of a leaf, a drop of water, the wear on an old tool. Fill the frame and keep your focus sharp on one spot.'),
  ('Reflections', 'Puddles, windows, mirrors, sunglasses and still water can all show a second version of the world. Try framing so the reflection is the main subject, or so it''s hard to tell which way is up.'),
  ('Silhouettes', 'A silhouette is a subject shot against a bright background so it turns into a dark shape. Put the light behind your subject, expose for the sky, and choose shapes that are easy to recognize from their outline.'),
  ('After dark', 'Night photography is about the light that''s left: street lamps, neon signs, headlights, the moon. Hold steady or brace your camera, and let the dark areas stay dark so the light stands out.'),
  ('Motion', 'Show that something is moving. Freeze it with a fast shutter to catch a splash or a jump, or blur it with a slow one so it feels fast. Following a moving subject with your camera (panning) keeps it sharp against a streaked background.'),
  ('Minimalism', 'Less is more: one subject, lots of empty space, and nothing in the frame that doesn''t need to be there. Look for clean backgrounds like sky, walls or water, and let the empty space be part of the photo.'),
  ('Patterns & textures', 'Repeating shapes, lines and surfaces are everywhere: brickwork, tiles, leaves, fabric, rows of windows. Fill the frame with the pattern, or find the one thing that breaks it.'),
  ('Shadows', 'This week the shadow is the subject. Hard light from a low sun or a single lamp makes long, sharp shadows. Look for shadows that make interesting shapes, or that tell a different story than the object casting them.'),
  ('One color', 'Build a photo around a single color: a red door, a yellow raincoat, a blue wall. Keep other colors out of the frame or let them fade into the background so your one color is impossible to miss.'),
  ('Leading lines', 'Leading lines guide the eye through a photo: roads, rails, fences, rivers, staircases. Place them so they lead toward your subject or into the distance, and try starting them from a corner of the frame.'),
  ('Water', 'Water changes with every shot: rippling, crashing, still as glass, or frozen mid-splash. Get low to the surface, try both fast and slow shutter speeds, and watch how it reflects the light and sky.'),
  ('Animals', 'Pets, birds, insects and wildlife all count. Get down to their eye level, be patient, and focus on the eyes. Natural behavior, like a stretch, a yawn or a curious look, makes the best shots.'),
  ('Architecture', 'Buildings are full of lines, shapes and character, from old churches to parking garages. Look up, find symmetry or an unusual angle, and keep vertical lines straight unless you''re tilting on purpose.'),
  ('Self-portrait', 'Turn the camera on yourself. It doesn''t have to show your face: your shadow, your hands, a reflection or the things you carry can all say who you are. Use a timer or a mirror and take your time.'),
  ('Frame within a frame', 'Use something in the scene, like a doorway, window, arch, branches or a gap between buildings, to frame your subject. It draws the eye straight to what matters and adds depth to the photo.'),
  ('Golden hour', 'The hour after sunrise and the hour before sunset give soft, warm, low light that makes almost anything look good. Shoot toward the sun for glow and silhouettes, or away from it for rich, warm color.'),
  ('Black and white', 'Without color, a photo is all about light, shadow, shape and texture. Look for strong contrast and interesting tones. On a phone, use a mono mode or remove the color afterwards.'),
  ('Ansel Adams', 'Ansel Adams is an icon of photography, known for his sharp black and white photos of nature, especially Yosemite and the American West. His photos have deep blacks, bright whites and detail everywhere in between, with big skies and dramatic light. Shoot a landscape in black and white, wait for dramatic light, and keep everything from front to back in focus.')
) as v(name, overview)
where r.name = v.name;

-- Themes that have already started pick up their overview too
update public.themes t set overview = r.overview
from public.theme_rotation r
where lower(r.name) = lower(t.name) and t.overview is null;

-- Same as 20261110_theme_rotation.sql, but each new week also gets its
-- overview and example photo
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

  insert into themes (name, start_date, end_date, recommended_films, overview, example_image_url, results_processed)
  values (next_row.name, next_start, theme_end_for(next_start), next_row.recommended_films, next_row.overview,
          next_row.example_image_url, false);
end;
$$;

revoke all on function public.ensure_current_theme() from public;
grant execute on function public.ensure_current_theme() to anon, authenticated;

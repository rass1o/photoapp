-- Designed avatar frames for the Shop, designed banners saved for the next
-- blind box, and badges that are earned instead of bought.
-- Run after 20261111_epic_sidekicks.sql.

------------------------------------------------------------------------------
-- Frames with decorations (drawn in the app, see AvatarFrame.tsx). The value
-- is the design's name instead of a color.
------------------------------------------------------------------------------
insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order) values
  ('frame-cat-ears',     'frame', 'cat_ears',     'Cat ears',      50, true, null, 10),
  ('frame-sombrero',     'frame', 'sombrero',     'Sombrero',      60, true, null, 11),
  ('frame-camera-top',   'frame', 'camera_top',   'Camera on top', 60, true, null, 12),
  ('frame-starfish',     'frame', 'starfish',     'Starfish',      50, true, null, 13),
  ('frame-bubbles',      'frame', 'bubbles',      'Bubbles',       40, true, null, 14),
  ('frame-kelp',         'frame', 'kelp',         'Kelp forest',   50, true, null, 15),
  ('frame-film-strip',   'frame', 'film_strip',   'Film strip',    70, true, null, 16),
  ('frame-tentacle-hug', 'frame', 'tentacle_hug', 'Ocho hug',      80, true, null, 17),
  ('frame-pearls',       'frame', 'pearls',       'Pearls',        90, true, null, 18)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Banners with scenes (drawn in the app, see BannerArt.tsx). Shown in the
-- Shop but not for sale: they'll come from the next blind box.
------------------------------------------------------------------------------
insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box) values
  ('banner-shark',       'banner', 'shark',       'Shark',       100, false, 'Coming in the next blind box', 10, 'epic',      false),
  ('banner-island',      'banner', 'island',      'Island',       60, false, 'Coming in the next blind box', 11, 'rare',      false),
  ('banner-coral-reef',  'banner', 'coral_reef',  'Coral reef',   60, false, 'Coming in the next blind box', 12, 'rare',      false),
  ('banner-whale',       'banner', 'whale',       'Whale',       100, false, 'Coming in the next blind box', 13, 'epic',      false),
  ('banner-sunset-sail', 'banner', 'sunset_sail', 'Sunset sail', 150, false, 'Coming in the next blind box', 14, 'legendary', false)
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box;

------------------------------------------------------------------------------
-- Badges: no more buying. The old bought ones are retired (people who own
-- them keep them); the rest are earned by doing things in the app.
------------------------------------------------------------------------------
update public.shop_items
set is_purchasable = false, unlock_hint = 'Retired'
where id in ('badge-aperture', 'badge-film', 'badge-golden-hour', 'badge-night-owl', 'badge-collector');

update public.shop_items set label = 'Streak'                    where id = 'badge-streak';
update public.shop_items set label = 'Sea King',  unlock_hint = 'Win 1st place in a weekly theme' where id = 'badge-weekly-winner';
update public.shop_items set label = 'Top Voter' where id = 'badge-top-voter';
update public.shop_items set label = 'Early Bird' where id = 'badge-early-bird';

-- value is the icon shown on the profile (one per badge)
insert into public.shop_items (id, category, value, label, price, is_purchasable, unlock_hint, sort_order) values
  ('badge-first-splash',     'badge', 'water-outline',    'First Splash',     0, false, 'Post your first weekly photo', 20),
  ('badge-occupied-octopus', 'badge', 'calendar-outline', 'Occupied Octopus', 0, false, 'Post a daily photo 7 days in a row', 21),
  ('badge-hot-one',          'badge', 'bonfire-outline',  'Hot One',          0, false, 'Keep a 14-day daily streak', 22),
  ('badge-on-fire',          'badge', 'flame',            'On Fire',          0, false, 'Keep a 30-day daily streak', 23),
  ('badge-tide-keeper',      'badge', 'repeat-outline',   'Tide Keeper',      0, false, 'Enter 4 weekly themes in a row', 24),
  ('badge-podium',           'badge', 'podium-outline',   'Podium',           0, false, 'Finish in the top 5 of a weekly theme', 25),
  ('badge-film-buff',        'badge', 'camera-outline',   'Film Buff',        0, false, 'Post 5 film photos', 26),
  ('badge-school-of-fish',   'badge', 'people-outline',   'School of Fish',   0, false, 'Make 5 friends', 27),
  ('badge-lucky-find',       'badge', 'sparkles-outline', 'Lucky Find',       0, false, 'Find a legendary sidekick in a clam', 28)
on conflict (id) do update set
  label = excluded.label,
  unlock_hint = excluded.unlock_hint,
  is_purchasable = excluded.is_purchasable,
  sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Award every badge someone has earned and doesn't have yet. Returns the
-- newly earned ones. (Sea King, Top Voter and Early Bird are also handed
-- out by the weekly payout.)
------------------------------------------------------------------------------
create or replace function public.award_badges_for(p_user uuid)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  prof profiles;
begin
  select * into prof from profiles where id = p_user;
  if not found then
    return;
  end if;

  return query
  with added as (
  insert into user_inventory (user_id, item_id)
  select p_user, earned.item_id
  from (
    select 'badge-first-splash' as item_id
      where exists (select 1 from submissions where user_id = p_user)
    union all select 'badge-occupied-octopus' where coalesce(prof.daily_streak_count, 0) >= 7
    union all select 'badge-hot-one'          where coalesce(prof.daily_streak_count, 0) >= 14
    union all select 'badge-on-fire'          where coalesce(prof.daily_streak_count, 0) >= 30
    union all select 'badge-tide-keeper'      where coalesce(prof.streak_count, 0) >= 4
    union all select 'badge-weekly-winner'
      where exists (select 1 from theme_results where user_id = p_user and place = 1)
    union all select 'badge-podium'
      where exists (select 1 from theme_results where user_id = p_user and place <= 5)
    union all select 'badge-film-buff'
      where (select count(*) from submissions where user_id = p_user and format = 'film') >= 5
    union all select 'badge-school-of-fish'
      where (select count(*) from friendships
             where status = 'accepted' and (requester_id = p_user or addressee_id = p_user)) >= 5
    union all select 'badge-lucky-find'
      where exists (
        select 1 from user_inventory u join shop_items i on i.id = u.item_id
        where u.user_id = p_user and i.category = 'octo_pet' and i.rarity = 'legendary'
      )
  ) earned
  where not exists (select 1 from user_inventory u where u.user_id = p_user and u.item_id = earned.item_id)
  returning user_inventory.item_id
  )
  select added.item_id from added;
end;
$$;

-- The app calls this (e.g. when you open your profile) and celebrates
-- whatever comes back
create or replace function public.check_my_badges()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return '{}';
  end if;
  return array(select public.award_badges_for(auth.uid()));
end;
$$;

revoke all on function public.award_badges_for(uuid) from public, anon, authenticated;
revoke all on function public.check_my_badges() from public, anon;
grant execute on function public.check_my_badges() to authenticated;

-- Hand out what everyone has already earned
select count(*) as badges_awarded from public.profiles p, lateral public.award_badges_for(p.id);

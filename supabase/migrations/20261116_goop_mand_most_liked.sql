-- Two new legendary sidekicks (Goop the capybara, Mand the red panda), a
-- 200-shutter prize for the most-liked photo when voting opens, and
-- category winners raised to 500. Run after 20261115_jellyfish_banner.sql.

insert into public.shop_items
  (id, category, value, label, price, is_purchasable, unlock_hint, sort_order, rarity, in_blind_box, box)
values
  ('octo-pet-goop', 'octo_pet', 'goop', 'Goop', 150, false, 'Legendary · find it in a clam', 9,  'legendary', true, 'clam'),
  ('octo-pet-mand', 'octo_pet', 'mand', 'Mand', 150, false, 'Legendary · find it in a clam', 10, 'legendary', true, 'clam')
on conflict (id) do update set
  label = excluded.label,
  price = excluded.price,
  is_purchasable = excluded.is_purchasable,
  unlock_hint = excluded.unlock_hint,
  rarity = excluded.rarity,
  in_blind_box = excluded.in_blind_box,
  box = excluded.box;

------------------------------------------------------------------------------
-- Most liked at voting time: 200 shutters to the photo with the most likes
-- made before voting opened (ties go to whoever posted first). Settled the
-- first time anyone opens the app once voting has started.
------------------------------------------------------------------------------
alter table public.themes add column if not exists most_liked_processed boolean not null default false;

create table if not exists public.theme_like_results (
  theme_id text primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null,
  like_count int not null,
  reward int not null
);

alter table public.theme_like_results enable row level security;
drop policy if exists "read like results" on public.theme_like_results;
create policy "read like results" on public.theme_like_results for select using (true);

create or replace function public.process_due_payouts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  processed int := 0;
begin
  -- Voting has opened: crown the most-liked photo (only likes from before
  -- voting count). Runs before the end-of-theme step below clears likes.
  for t in
    select id, end_date
    from themes
    where theme_voting_opens(end_date) <= now() and not most_liked_processed
    order by end_date
    for update skip locked
  loop
    with winner as (
      select s.id, s.user_id, count(l.id)::int as likes
      from submissions s
      join likes l on l.submission_id = s.id and l.created_at < theme_voting_opens(t.end_date)
      where s.theme_id::text = t.id::text
      group by s.id, s.user_id, s.created_at
      order by count(l.id) desc, s.created_at
      limit 1
    ), saved as (
      insert into theme_like_results (theme_id, submission_id, user_id, like_count, reward)
      select t.id::text, id, user_id, likes, 200 from winner
      on conflict do nothing
      returning user_id, reward
    )
    update profiles p set currency_balance = p.currency_balance + saved.reward
    from saved
    where p.id = saved.user_id;

    update themes set most_liked_processed = true where id = t.id;
  end loop;

  for t in
    select id, start_date
    from themes
    where end_date < now() and not coalesce(results_processed, false)
    order by end_date
    for update skip locked
  loop
    -- Top 3 overall by votes (ties share a place: 10, 10, 7 votes -> 1, 1, 3)
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 750 when 2 then 500 else 300 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 3
    on conflict do nothing;

    -- One winner per category (ties go to whoever posted first)
    insert into theme_category_results (theme_id, category, submission_id, user_id, vote_count, reward)
    select distinct on (cv.category)
           t.id::text, cv.category, cv.submission_id, s.user_id, count(*)::int, 500
    from category_votes cv
    join submissions s on s.id = cv.submission_id
    where cv.theme_id = t.id::text
    group by cv.category, cv.submission_id, s.user_id, s.created_at
    order by cv.category, count(*) desc, s.created_at
    on conflict do nothing;

    update profiles p
    set currency_balance = p.currency_balance + r.total
    from (
      select user_id, sum(reward) as total
      from (
        select user_id, reward from theme_results where theme_id = t.id::text
        union all
        select user_id, reward from theme_category_results where theme_id = t.id::text
      ) all_prizes
      group by user_id
    ) r
    where p.id = r.user_id;

    -- Earned badges
    insert into user_inventory (user_id, item_id)
    select distinct user_id, 'badge-weekly-winner'
    from theme_results
    where theme_id = t.id::text and place = 1
    on conflict do nothing;

    insert into user_inventory (user_id, item_id)
    select distinct s.user_id, 'badge-early-bird'
    from submissions s
    where s.theme_id::text = t.id::text
      and s.created_at < t.start_date + interval '24 hours'
    on conflict do nothing;

    -- Skipped this theme: streak's over (unless already rebuilding one)
    update profiles p
    set streak_count = 0
    where coalesce(p.streak_count, 0) <> 0
      and not exists (
        select 1 from submissions s
        join themes th on th.id::text = s.theme_id::text
        where s.user_id = p.id and th.start_date >= t.start_date
      );

    -- Fresh start: this theme's likes are cleared
    delete from likes l
    using submissions s
    where l.submission_id = s.id and s.theme_id::text = t.id::text;

    update themes set results_processed = true where id = t.id;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

-- Themes that ended before this prize existed are already settled
update public.themes set most_liked_processed = true where end_date < now();

-- Weekly payouts: one global top 5 across digital and film, instead of a
-- top 3 per format. Rewards 1st -> 5th: 50, 40, 30, 20, 15 shutters.
-- Run after 20261030_friends.sql. Safe to re-run. Themes that were already
-- paid out keep their old results.

alter table public.theme_results drop constraint if exists theme_results_place_check;
alter table public.theme_results add constraint theme_results_place_check check (place between 1 and 5);

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
  for t in
    select id, start_date
    from themes
    where end_date < now() and not coalesce(results_processed, false)
    order by end_date
    for update skip locked
  loop
    -- Top 5 overall, any format (format is kept for display). rank() gives
    -- ties the same place and skips the next (10, 10, 7 votes -> 1, 1, 3).
    -- Photos need at least one vote.
    insert into theme_results (theme_id, format, place, submission_id, user_id, vote_count, reward)
    select t.id::text, ranked.format, ranked.place, ranked.id, ranked.user_id, ranked.vote_count,
           case ranked.place when 1 then 50 when 2 then 40 when 3 then 30 when 4 then 20 else 15 end
    from (
      select s.id, s.user_id, s.format, s.vote_count,
             rank() over (order by s.vote_count desc) as place
      from submissions s
      where s.theme_id::text = t.id::text and s.vote_count > 0
    ) ranked
    where ranked.place <= 5
    on conflict do nothing;

    update profiles p
    set currency_balance = p.currency_balance + r.total
    from (
      select user_id, sum(reward) as total
      from theme_results
      where theme_id = t.id::text
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

    insert into user_inventory (user_id, item_id)
    select voter_id, 'badge-top-voter'
    from (
      select v.user_id as voter_id, rank() over (order by count(*) desc) as voter_rank
      from votes v
      join submissions s on s.id = v.submission_id
      where s.theme_id::text = t.id::text
      group by v.user_id
    ) voters
    where voter_rank = 1
    on conflict do nothing;

    update themes set results_processed = true where id = t.id;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

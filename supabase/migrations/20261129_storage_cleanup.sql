-- Finding photo files nothing uses anymore. Run after
-- 20261128_new_rewards_clear_notifications.sql. Safe to re-run.
--
-- Photo files stay in Storage when the photo itself goes: a deleted post, a
-- replaced profile or showcase photo, a photo removed after a report, a
-- deleted group or theme, a rejected review, a deleted account. This lists
-- them so the cleanup-storage function can delete them through the Storage
-- API (deleting rows from storage.objects in SQL would leave the files
-- behind).
--
-- To be safe it only ever lists files that:
--   * are in the submissions or avatars bucket, inside a user's folder
--     (<user id>/...), so files like the theme example photos are never
--     touched
--   * are more than 2 days old, so a photo that's still being posted (or
--     waiting in an app that's offline) is never caught halfway
--   * aren't linked from anywhere: every text column in the public schema
--     is searched for Storage links, so a new table that stores photos is
--     covered without changing this. Photo reviews only count while
--     they're pending.

create or replace function public.orphaned_photo_files(p_limit int default 500)
returns table (bucket_id text, name text, size bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  col record;
begin
  create temp table if not exists used_photo_paths (path text primary key) on commit drop;
  truncate used_photo_paths;

  -- Every Storage link in every text column, as 'bucket/path'
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
      and c.table_name <> 'photo_reviews'
  loop
    execute format(
      'insert into used_photo_paths
       select distinct regexp_replace(split_part(%1$I, ''?'', 1), ''^.*/storage/v1/object/(public|sign|authenticated)/'', '''')
       from public.%2$I
       where %1$I like ''%%/storage/v1/object/%%''
       on conflict do nothing',
      col.column_name, col.table_name
    );
  end loop;

  -- Photos waiting for review are kept; rejected ones can go
  insert into used_photo_paths
  select 'submissions/' || r.file_path from public.photo_reviews r where r.status = 'pending'
  on conflict do nothing;

  return query
  select o.bucket_id::text, o.name::text, coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where o.bucket_id in ('submissions', 'avatars')
    and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    and o.created_at < now() - interval '2 days'
    and not exists (select 1 from used_photo_paths u where u.path = o.bucket_id || '/' || o.name)
  order by o.created_at
  limit greatest(p_limit, 1);
end;
$$;

-- Only the cleanup function (with the service role key) can ask
revoke all on function public.orphaned_photo_files(int) from public, anon, authenticated;
grant execute on function public.orphaned_photo_files(int) to service_role;

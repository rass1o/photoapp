-- Let people see and delete the photo files in their own folder, so
-- "Delete account" in Settings can remove their uploads too (every file is
-- stored under <user id>/ in the submissions and avatars buckets).
-- Run after 20261108_colors_feedback_delete_account.sql.

drop policy if exists "list own photo files" on storage.objects;
create policy "list own photo files" on storage.objects
for select to authenticated
using (bucket_id in ('submissions', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own photo files" on storage.objects;
create policy "delete own photo files" on storage.objects
for delete to authenticated
using (bucket_id in ('submissions', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

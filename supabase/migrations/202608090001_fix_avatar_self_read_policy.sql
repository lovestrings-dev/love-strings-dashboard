-- Personal avatars are user-owned, independent of workspace membership.
drop policy if exists "Members can read avatars" on storage.objects;

create policy "Users can read their own avatar" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

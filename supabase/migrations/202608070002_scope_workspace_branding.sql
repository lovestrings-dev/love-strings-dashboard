-- Make branding paths tenant-safe. Existing Love Strings logos remain in the
-- legacy folder and are explicitly mapped to the original workspace.

create or replace function public.branding_workspace_id_from_path(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) = 'love-strings'
      then '00000000-0000-0000-0000-000000000001'::uuid
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function public.is_workspace_branding_path(
  check_workspace_id uuid,
  object_name text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select object_name = ''
    or public.branding_workspace_id_from_path(object_name) = check_workspace_id;
$$;

grant execute on function public.branding_workspace_id_from_path(text) to authenticated;
grant execute on function public.is_workspace_branding_path(uuid, text) to authenticated;

drop policy if exists "Owners can update workspace settings" on public.app_workspace_settings;
drop policy if exists "Workspace administrators can update workspace settings"
on public.app_workspace_settings;
create policy "Workspace administrators can update workspace settings"
on public.app_workspace_settings
for update to authenticated
using (public.is_workspace_administrator(workspace_id))
with check (
  public.is_workspace_administrator(workspace_id)
  and public.is_workspace_branding_path(workspace_id, logo_path)
);

drop policy if exists "Members can read branding" on storage.objects;
create policy "Workspace members can read their branding" on storage.objects
for select to authenticated
using (
  bucket_id = 'branding'
  and public.is_workspace_member(public.branding_workspace_id_from_path(name))
);

drop policy if exists "Owners can upload branding" on storage.objects;
drop policy if exists "Workspace administrators can upload branding" on storage.objects;
create policy "Workspace administrators can upload their branding" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and public.is_workspace_administrator(public.branding_workspace_id_from_path(name))
);

drop policy if exists "Owners can update branding" on storage.objects;
drop policy if exists "Workspace administrators can update branding" on storage.objects;
create policy "Workspace administrators can update their branding" on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and public.is_workspace_administrator(public.branding_workspace_id_from_path(name))
)
with check (
  bucket_id = 'branding'
  and public.is_workspace_administrator(public.branding_workspace_id_from_path(name))
);

drop policy if exists "Owners can delete branding" on storage.objects;
drop policy if exists "Workspace administrators can delete branding" on storage.objects;
create policy "Workspace administrators can delete their branding" on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and public.is_workspace_administrator(public.branding_workspace_id_from_path(name))
);

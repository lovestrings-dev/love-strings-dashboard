alter table public.app_workspace_members
drop constraint if exists app_workspace_members_role_check;

alter table public.app_workspace_members
add constraint app_workspace_members_role_check
check (role in ('owner', 'member', 'viewer'));

create or replace function public.is_love_strings_owner(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_workspace_members
    where workspace_id = '00000000-0000-0000-0000-000000000001'
      and user_id = check_user_id
      and role = 'owner'
  );
$$;

create or replace function public.enrol_love_strings_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'workspace_role', 'viewer'));

  if requested_role not in ('owner', 'member', 'viewer') then
    requested_role := 'viewer';
  end if;

  insert into public.app_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, requested_role)
  on conflict (workspace_id, user_id) do nothing;

  insert into public.dashboard_preferences (workspace_id, user_id)
  values ('00000000-0000-0000-0000-000000000001', new.id)
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

update public.app_workspace_members membership
set role = 'owner'
from auth.users app_user
where membership.user_id = app_user.id
  and lower(app_user.email) = 'dimasounder@gmail.com';

update public.app_workspace_members membership
set role = 'member'
from auth.users app_user
where membership.user_id = app_user.id
  and lower(app_user.email) = 'yuliiakostyts@gmail.com';

drop policy if exists "Members can update workspace settings" on public.app_workspace_settings;
create policy "Owners can update workspace settings" on public.app_workspace_settings
for update to authenticated
using (public.is_love_strings_owner())
with check (public.is_love_strings_owner());

drop policy if exists "Members can upload branding" on storage.objects;
create policy "Owners can upload branding" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_owner()
);

drop policy if exists "Members can update branding" on storage.objects;
create policy "Owners can update branding" on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_owner()
)
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_owner()
);

drop policy if exists "Members can delete branding" on storage.objects;
create policy "Owners can delete branding" on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_owner()
);

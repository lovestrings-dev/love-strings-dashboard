create table if not exists public.app_workspace_settings (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  logo_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_workspace_settings (workspace_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (workspace_id) do nothing;

alter table public.app_workspace_settings enable row level security;

drop policy if exists "Members can read workspace settings" on public.app_workspace_settings;
create policy "Members can read workspace settings" on public.app_workspace_settings
for select to authenticated
using (public.is_love_strings_member());

drop policy if exists "Members can update workspace settings" on public.app_workspace_settings;
create policy "Members can update workspace settings" on public.app_workspace_settings
for update to authenticated
using (public.is_love_strings_member())
with check (public.is_love_strings_member());

drop trigger if exists app_workspace_settings_set_updated_at on public.app_workspace_settings;
create trigger app_workspace_settings_set_updated_at
before update on public.app_workspace_settings
for each row execute function public.set_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'branding',
  'branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can read branding" on storage.objects;
create policy "Members can read branding" on storage.objects
for select to authenticated
using (bucket_id = 'branding' and public.is_love_strings_member());

drop policy if exists "Members can upload branding" on storage.objects;
create policy "Members can upload branding" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_member()
);

drop policy if exists "Members can update branding" on storage.objects;
create policy "Members can update branding" on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_member()
)
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_member()
);

drop policy if exists "Members can delete branding" on storage.objects;
create policy "Members can delete branding" on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = 'love-strings'
  and public.is_love_strings_member()
);

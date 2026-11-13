-- Studio owns creative source assets. Production only reads the current Studio
-- audio asset through its linked Studio project; it does not own audio URLs.
create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  production_song_id uuid references public.production_songs(id) on delete set null,
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, production_song_id)
);

create table public.studio_audio_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  asset_kind text not null default 'song-source' check (asset_kind in ('song-source', 'music-bed', 'voiceover', 'effect')),
  cloudinary_url text not null,
  original_file_name text not null,
  mime_type text not null default 'audio/mpeg',
  byte_size bigint not null default 0 check (byte_size >= 0),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index studio_audio_assets_one_current_kind_per_project_idx
  on public.studio_audio_assets (studio_project_id, asset_kind)
  where is_current;
create index studio_projects_workspace_song_idx
  on public.studio_projects (workspace_id, production_song_id);
create index studio_audio_assets_workspace_project_idx
  on public.studio_audio_assets (workspace_id, studio_project_id, created_at desc);

create trigger studio_projects_set_updated_at
before update on public.studio_projects
for each row execute function public.set_updated_at();
create trigger studio_audio_assets_set_updated_at
before update on public.studio_audio_assets
for each row execute function public.set_updated_at();

alter table public.studio_projects enable row level security;
alter table public.studio_audio_assets enable row level security;

create policy "Workspace members can read Studio projects"
on public.studio_projects for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio audio assets"
on public.studio_audio_assets for select to authenticated
using (public.is_workspace_member(workspace_id));

-- Durable, workspace-scoped Studio composition data. Source media remains
-- private; rows only retain metadata and private object paths.
create table public.studio_project_compositions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null unique references public.studio_projects(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  duration_seconds integer not null default 15 check (duration_seconds between 1 and 180),
  format text not null default 'vertical-9:16' check (format = 'vertical-9:16'),
  overlay jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_audio_snippets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  source_asset_id uuid not null references public.studio_audio_assets(id) on delete restrict,
  start_seconds numeric(8,3) not null check (start_seconds >= 0),
  end_seconds numeric(8,3) not null check (end_seconds > start_seconds),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_project_id, source_asset_id, start_seconds, end_seconds)
);

create table public.studio_video_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  source_provider text not null check (source_provider in ('pexels', 'upload')),
  provider_asset_id text,
  provider_page_url text,
  staging_object_path text not null,
  original_file_name text not null,
  mime_type text not null default 'video/mp4',
  byte_size bigint not null default 0 check (byte_size >= 0),
  duration_seconds numeric(8,3) not null check (duration_seconds > 0 and duration_seconds <= 1800),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, staging_object_path)
);

create table public.studio_video_snippets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  source_asset_id uuid not null references public.studio_video_assets(id) on delete restrict,
  start_seconds numeric(8,3) not null check (start_seconds >= 0),
  end_seconds numeric(8,3) not null check (end_seconds > start_seconds),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_selected boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_project_id, source_asset_id, start_seconds, end_seconds)
);

create table public.studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  composition_version integer not null default 1,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  manifest_object_path text not null,
  output_object_path text not null,
  provider_execution_id text,
  failure_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, manifest_object_path),
  unique (workspace_id, output_object_path)
);

create table public.studio_rendered_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  studio_project_id uuid not null references public.studio_projects(id) on delete cascade,
  render_job_id uuid not null unique references public.studio_render_jobs(id) on delete cascade,
  object_path text not null,
  mime_type text not null default 'video/mp4',
  byte_size bigint,
  duration_seconds numeric(8,3),
  width integer not null default 1080 check (width > 0),
  height integer not null default 1920 check (height > 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, object_path)
);

create index studio_compositions_workspace_project_idx on public.studio_project_compositions(workspace_id, studio_project_id);
create index studio_audio_snippets_workspace_project_idx on public.studio_audio_snippets(workspace_id, studio_project_id, sort_order);
create index studio_video_assets_workspace_project_idx on public.studio_video_assets(workspace_id, studio_project_id, created_at desc);
create index studio_video_snippets_workspace_project_idx on public.studio_video_snippets(workspace_id, studio_project_id, sort_order);
create index studio_render_jobs_workspace_project_idx on public.studio_render_jobs(workspace_id, studio_project_id, created_at desc);
create index studio_rendered_assets_workspace_project_idx on public.studio_rendered_assets(workspace_id, studio_project_id, created_at desc);

create trigger studio_project_compositions_set_updated_at before update on public.studio_project_compositions for each row execute function public.set_updated_at();
create trigger studio_audio_snippets_set_updated_at before update on public.studio_audio_snippets for each row execute function public.set_updated_at();
create trigger studio_video_assets_set_updated_at before update on public.studio_video_assets for each row execute function public.set_updated_at();
create trigger studio_video_snippets_set_updated_at before update on public.studio_video_snippets for each row execute function public.set_updated_at();
create trigger studio_render_jobs_set_updated_at before update on public.studio_render_jobs for each row execute function public.set_updated_at();

alter table public.studio_project_compositions enable row level security;
alter table public.studio_audio_snippets enable row level security;
alter table public.studio_video_assets enable row level security;
alter table public.studio_video_snippets enable row level security;
alter table public.studio_render_jobs enable row level security;
alter table public.studio_rendered_assets enable row level security;

create policy "Workspace members can read Studio compositions" on public.studio_project_compositions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio audio snippets" on public.studio_audio_snippets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio video assets" on public.studio_video_assets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio video snippets" on public.studio_video_snippets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio render jobs" on public.studio_render_jobs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read Studio rendered assets" on public.studio_rendered_assets for select to authenticated using (public.is_workspace_member(workspace_id));

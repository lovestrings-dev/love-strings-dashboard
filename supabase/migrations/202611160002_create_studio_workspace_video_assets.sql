-- Uploaded Studio footage must be available to every authorised device in the
-- workspace. The bucket remains private; this table deliberately stores only
-- object paths and browser-safe metadata.
create table public.studio_workspace_video_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  object_path text not null,
  original_file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 524288000),
  duration_seconds numeric(8,3) not null check (duration_seconds > 0 and duration_seconds <= 1800),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, object_path)
);

create index studio_workspace_video_assets_workspace_created_idx
  on public.studio_workspace_video_assets(workspace_id, created_at desc);

create trigger studio_workspace_video_assets_set_updated_at
before update on public.studio_workspace_video_assets
for each row execute function public.set_updated_at();

alter table public.studio_workspace_video_assets enable row level security;

create policy "Workspace members can read shared Studio video assets"
on public.studio_workspace_video_assets for select to authenticated
using (public.is_workspace_member(workspace_id));

alter table public.studio_workspace_selection_drafts
  add column uploaded_video_snippets jsonb not null default '[]'::jsonb;

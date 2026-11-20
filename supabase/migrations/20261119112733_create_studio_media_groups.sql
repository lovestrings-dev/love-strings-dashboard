-- Durable, private Studio output groups. A group owns copies of explicitly
-- selected renders; normal temporary render outputs remain replaceable.
create table public.studio_media_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index studio_media_groups_workspace_created_idx on public.studio_media_groups (workspace_id, created_at desc);
alter table public.studio_media_groups enable row level security;
create policy "Workspace members can read Studio media groups" on public.studio_media_groups for select to authenticated using (public.is_workspace_member(workspace_id));

-- One source render may be preserved in more than one named group. Existing
-- one-off scheduled Reel artifacts keep their old unique object paths.
alter table public.studio_publish_artifacts drop constraint studio_publish_artifacts_workspace_id_render_job_id_key;

create table public.studio_media_group_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  group_id uuid not null references public.studio_media_groups(id) on delete cascade,
  publish_artifact_id uuid not null references public.studio_publish_artifacts(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (group_id, publish_artifact_id),
  unique (publish_artifact_id)
);
create index studio_media_group_items_workspace_group_idx on public.studio_media_group_items (workspace_id, group_id, sort_order);
alter table public.studio_media_group_items enable row level security;
create policy "Workspace members can read Studio media group items" on public.studio_media_group_items for select to authenticated using (public.is_workspace_member(workspace_id));

-- Library artifacts use retained_until = NULL intentionally. Their lifecycle
-- is controlled by an explicit archive/delete action, never by render cleanup.

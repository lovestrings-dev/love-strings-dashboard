-- Browser-local Studio choices cannot follow a workspace member across devices.
-- Keep the current Test Project's selection metadata in the workspace instead.
create table public.studio_workspace_selection_drafts (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  audio_snippets jsonb not null default '[]'::jsonb,
  pixabay_video_snippets jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger studio_workspace_selection_drafts_set_updated_at
before update on public.studio_workspace_selection_drafts
for each row execute function public.set_updated_at();

alter table public.studio_workspace_selection_drafts enable row level security;

create policy "Workspace members can read Studio selection drafts"
on public.studio_workspace_selection_drafts for select to authenticated
using (public.is_workspace_member(workspace_id));

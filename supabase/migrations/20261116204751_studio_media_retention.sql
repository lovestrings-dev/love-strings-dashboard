alter table public.studio_workspace_video_assets add column deleted_at timestamptz;
alter table public.studio_render_jobs add column batch_id uuid;
create index studio_render_jobs_workspace_batch_idx on public.studio_render_jobs(workspace_id, batch_id);

-- Server-owned cursor prevents an older device queue from replacing a newer batch.
create table public.studio_render_retention_state (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  batch_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.studio_render_retention_state enable row level security;
revoke all on public.studio_render_retention_state from anon, authenticated;
grant all on public.studio_render_retention_state to service_role;

-- Preserve concurrent audio/Pixabay edits while removing the deleted source.
create function public.studio_remove_deleted_video_from_draft(p_workspace_id uuid, p_asset_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.studio_workspace_selection_drafts
  set uploaded_video_snippets = coalesce((
    select jsonb_agg(snippet) from jsonb_array_elements(uploaded_video_snippets) snippet
    where snippet->>'assetId' is distinct from p_asset_id::text
  ), '[]'::jsonb)
  where workspace_id = p_workspace_id;
$$;
revoke all on function public.studio_remove_deleted_video_from_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.studio_remove_deleted_video_from_draft(uuid, uuid) to service_role;

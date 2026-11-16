-- Prevent simultaneous submissions racing past the app's active-job check.
create unique index studio_render_jobs_one_active_per_workspace
  on public.studio_render_jobs(workspace_id)
  where status in ('queued', 'running');

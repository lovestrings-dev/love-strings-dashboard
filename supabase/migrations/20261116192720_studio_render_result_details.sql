-- Keep pair labels with each result and remove results without deleting sources.
alter table public.studio_render_jobs
  add column result_details jsonb,
  add column deleted_at timestamptz;

-- Phase 2: records in separate workspaces may reuse human-friendly stable keys.

alter table public.production_songs drop constraint production_songs_slug_key;
alter table public.production_songs
  add constraint production_songs_workspace_slug_key unique (workspace_id, slug);

alter table public.marketing_campaigns drop constraint marketing_campaigns_slug_key;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_workspace_slug_key unique (workspace_id, slug);

alter table public.focus_other_tasks drop constraint focus_other_tasks_stable_key_key;
alter table public.focus_other_tasks
  add constraint focus_other_tasks_workspace_stable_key_key
  unique (workspace_id, stable_key);

alter table public.focus_daily_progress
  drop constraint focus_daily_progress_activity_date_task_key_key;
alter table public.focus_daily_progress
  add constraint focus_daily_progress_workspace_date_task_key_key
  unique (workspace_id, activity_date, task_key);

alter table public.roadmap_phases drop constraint roadmap_phases_phase_number_key;
alter table public.roadmap_phases
  add constraint roadmap_phases_workspace_phase_number_key
  unique (workspace_id, phase_number);

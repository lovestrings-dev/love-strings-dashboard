-- Phase 1 of multi-workspace segregation: give every operational root record
-- an explicit owner without changing current uniqueness or route behavior.
-- Child records inherit ownership through their existing parent foreign keys.

alter table public.roadmap_phases
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.production_songs
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.marketing_campaigns
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.event_locations
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.events
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.budget_entries
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.budget_hidden_generated_entries
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.focus_other_tasks
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.focus_daily_progress
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.qr_links
  add column workspace_id uuid references public.app_workspaces(id) on delete cascade;

update public.roadmap_phases set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.production_songs set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.marketing_campaigns set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.event_locations set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.events set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.budget_entries set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.budget_hidden_generated_entries set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.focus_other_tasks set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.focus_daily_progress set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.qr_links set workspace_id = '00000000-0000-0000-0000-000000000001';

alter table public.roadmap_phases alter column workspace_id set not null;
alter table public.production_songs alter column workspace_id set not null;
alter table public.marketing_campaigns alter column workspace_id set not null;
alter table public.event_locations alter column workspace_id set not null;
alter table public.events alter column workspace_id set not null;
alter table public.budget_entries alter column workspace_id set not null;
alter table public.budget_hidden_generated_entries alter column workspace_id set not null;
alter table public.focus_other_tasks alter column workspace_id set not null;
alter table public.focus_daily_progress alter column workspace_id set not null;
alter table public.qr_links alter column workspace_id set not null;

alter table public.roadmap_phases alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.production_songs alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.marketing_campaigns alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.event_locations alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.events alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.budget_entries alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.budget_hidden_generated_entries alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.focus_other_tasks alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.focus_daily_progress alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.qr_links alter column workspace_id set default '00000000-0000-0000-0000-000000000001';

create index roadmap_phases_workspace_id_idx on public.roadmap_phases (workspace_id);
create index production_songs_workspace_id_idx on public.production_songs (workspace_id);
create index marketing_campaigns_workspace_id_idx on public.marketing_campaigns (workspace_id);
create index event_locations_workspace_id_idx on public.event_locations (workspace_id);
create index events_workspace_id_idx on public.events (workspace_id);
create index budget_entries_workspace_id_idx on public.budget_entries (workspace_id);
create index focus_other_tasks_workspace_id_idx on public.focus_other_tasks (workspace_id);
create index focus_daily_progress_workspace_id_idx on public.focus_daily_progress (workspace_id);
create index qr_links_workspace_id_idx on public.qr_links (workspace_id);

create or replace function public.is_workspace_member(
  check_workspace_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_workspace_members
    where workspace_id = check_workspace_id
      and user_id = check_user_id
  );
$$;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;

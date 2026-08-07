-- Enforce workspace membership at the row level. Child tables derive their
-- workspace through an existing parent foreign-key chain.

create or replace function public.is_workspace_owner(
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
    select 1 from public.app_workspace_members
    where workspace_id = check_workspace_id
      and user_id = check_user_id
      and role = 'owner'
  );
$$;
grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;

drop policy if exists "Members can read their workspace" on public.app_workspaces;
create policy "Members can read their workspaces" on public.app_workspaces
for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Members can read workspace settings" on public.app_workspace_settings;
create policy "Members can read workspace settings" on public.app_workspace_settings
for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Owners can update workspace settings" on public.app_workspace_settings;
create policy "Owners can update workspace settings" on public.app_workspace_settings
for update to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Members can read marketing campaigns" on public.marketing_campaigns;
create policy "Workspace members can read marketing campaigns" on public.marketing_campaigns
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read marketing campaign days" on public.marketing_campaign_days;
create policy "Workspace members can read marketing campaign days" on public.marketing_campaign_days
for select to authenticated using (exists (
  select 1 from public.marketing_campaigns campaign
  where campaign.id = campaign_id and public.is_workspace_member(campaign.workspace_id)
));

drop policy if exists "Members can read marketing campaign tasks" on public.marketing_campaign_tasks;
create policy "Workspace members can read marketing campaign tasks" on public.marketing_campaign_tasks
for select to authenticated using (exists (
  select 1
  from public.marketing_campaign_days campaign_day
  join public.marketing_campaigns campaign on campaign.id = campaign_day.campaign_id
  where campaign_day.id = campaign_day_id
    and public.is_workspace_member(campaign.workspace_id)
));

drop policy if exists "Members can read marketing campaign budget lines" on public.marketing_campaign_budget_lines;
create policy "Workspace members can read marketing campaign budget lines"
on public.marketing_campaign_budget_lines
for select to authenticated using (exists (
  select 1 from public.marketing_campaigns campaign
  where campaign.id = campaign_id and public.is_workspace_member(campaign.workspace_id)
));

drop policy if exists "Members can read production songs" on public.production_songs;
create policy "Workspace members can read production songs" on public.production_songs
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read production steps" on public.production_steps;
create policy "Workspace members can read production steps" on public.production_steps
for select to authenticated using (exists (
  select 1 from public.production_songs song
  where song.id = production_song_id and public.is_workspace_member(song.workspace_id)
));

drop policy if exists "Members can read production step tasks" on public.production_step_tasks;
create policy "Workspace members can read production step tasks" on public.production_step_tasks
for select to authenticated using (exists (
  select 1
  from public.production_steps step
  join public.production_songs song on song.id = step.production_song_id
  where step.id = production_step_id and public.is_workspace_member(song.workspace_id)
));

drop policy if exists "Members can read production budget lines" on public.production_budget_lines;
create policy "Workspace members can read production budget lines" on public.production_budget_lines
for select to authenticated using (
  exists (
    select 1
    from public.production_steps step
    join public.production_songs song on song.id = step.production_song_id
    where step.id = production_step_id and public.is_workspace_member(song.workspace_id)
  )
  or exists (
    select 1
    from public.production_step_tasks task
    join public.production_steps step on step.id = task.production_step_id
    join public.production_songs song on song.id = step.production_song_id
    where task.id = production_step_task_id and public.is_workspace_member(song.workspace_id)
  )
);

drop policy if exists "Members can read roadmap phases" on public.roadmap_phases;
create policy "Workspace members can read roadmap phases" on public.roadmap_phases
for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read event locations" on public.event_locations
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read events" on public.events
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read event budget lines" on public.event_budget_lines
for select to authenticated using (exists (
  select 1 from public.events event
  where event.id = event_id and public.is_workspace_member(event.workspace_id)
));

create policy "Workspace members can read budget entries" on public.budget_entries
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read hidden budget entries"
on public.budget_hidden_generated_entries
for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read other focus tasks" on public.focus_other_tasks
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read daily focus progress" on public.focus_daily_progress
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read QR links" on public.qr_links
for select to authenticated using (public.is_workspace_member(workspace_id));

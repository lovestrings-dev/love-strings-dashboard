-- First-Admin onboarding profile and authoritative workspace-default seeding.
--
-- Only a pending workspace can pass through this function. Existing workspaces,
-- songs, templates, Roadmap plans, campaigns, and users are intentionally left
-- unchanged.

alter table public.app_workspace_settings
  add column if not exists onboarding_release_frequency text,
  add column if not exists onboarding_distributor_answer text;

alter table public.app_workspace_settings
  drop constraint if exists app_workspace_settings_onboarding_release_frequency_check;
alter table public.app_workspace_settings
  add constraint app_workspace_settings_onboarding_release_frequency_check
  check (onboarding_release_frequency is null or onboarding_release_frequency in ('twice_monthly', 'monthly', 'undecided'));

alter table public.app_workspace_settings
  drop constraint if exists app_workspace_settings_onboarding_distributor_answer_check;
alter table public.app_workspace_settings
  add constraint app_workspace_settings_onboarding_distributor_answer_check
  check (onboarding_distributor_answer is null or onboarding_distributor_answer in ('yes', 'no', 'unknown'));

drop function if exists public.finalize_pending_workspace(uuid, uuid, text, text);

create function public.finalize_pending_workspace(
  p_workspace_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_workspace_name text,
  p_release_frequency text,
  p_distributor_answer text
)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_display_name text := trim(p_display_name);
  normalized_workspace_name text := trim(p_workspace_name);
  normalized_release_frequency text := trim(p_release_frequency);
  normalized_distributor_answer text := trim(p_distributor_answer);
  slug_base text;
  candidate_slug text;
  suffix integer := 2;
  workspace_record public.app_workspaces%rowtype;
  template_record public.production_templates%rowtype;
  production_window_days integer;
  release_cadence_days integer;
  song_campaign_length_days integer;
  song_campaign_advance_days integer;
  distributor_enabled boolean;
  configured_production_window_days integer;
begin
  if length(normalized_display_name) < 1 or length(normalized_display_name) > 120 then
    raise exception 'Enter a valid User Name.';
  end if;
  if length(normalized_workspace_name) < 2 or length(normalized_workspace_name) > 120 then
    raise exception 'Enter a valid Artist or Band Name.';
  end if;
  if normalized_release_frequency not in ('twice_monthly', 'monthly', 'undecided') then
    raise exception 'Choose how often you plan to release songs.';
  end if;
  if normalized_distributor_answer not in ('yes', 'no', 'unknown') then
    raise exception 'Choose whether you already have a Distributor.';
  end if;

  select * into workspace_record
  from public.app_workspaces
  where id = p_workspace_id
  for update;
  if not found then
    raise exception 'Workspace was not found.';
  end if;

  if not exists (
    select 1 from public.app_workspace_members
    where app_workspace_members.workspace_id = p_workspace_id
      and app_workspace_members.user_id = p_user_id
      and app_workspace_members.role = 'admin'
  ) then
    raise exception 'Only a workspace Admin can finish setup.';
  end if;

  if workspace_record.setup_state = 'active' then
    return query select workspace_record.id, workspace_record.name, workspace_record.slug, 'already_active';
    return;
  end if;
  if workspace_record.setup_state <> 'pending_setup' then
    raise exception 'Workspace setup is not available.';
  end if;

  if normalized_release_frequency = 'twice_monthly' then
    production_window_days := 14;
    release_cadence_days := 14;
    song_campaign_length_days := 7;
    song_campaign_advance_days := 2;
  else
    production_window_days := 28;
    release_cadence_days := 28;
    song_campaign_length_days := 14;
    song_campaign_advance_days := 3;
  end if;
  distributor_enabled := normalized_distributor_answer = 'yes';

  slug_base := trim(both '-' from regexp_replace(lower(normalized_workspace_name), '[^a-z0-9]+', '-', 'g'));
  if slug_base = '' then slug_base := 'workspace'; end if;
  slug_base := left(slug_base, 80);
  perform pg_advisory_xact_lock(hashtext(slug_base));
  candidate_slug := slug_base;
  while exists (select 1 from public.app_workspaces where slug = candidate_slug and id <> p_workspace_id) loop
    candidate_slug := left(slug_base, 80 - length(suffix::text) - 1) || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  select * into strict template_record
  from public.production_templates as template
  where template.workspace_id = p_workspace_id
    and template.is_active
    and template.scheduling_model = 'template-v1'
  for update;

  -- The original V1 default has a 25-day non-Distributor workflow. These
  -- proportional profiles preserve its sequence and relative emphasis while
  -- producing the approved 14- or 28-day Idea-to-Distributor-ready window.
  update public.production_template_steps as template_step
  set lead_time_days = case template_step.stable_key
    when 'drums-v1' then case when production_window_days = 14 then 1 else 2 end
    when 'guitars-v1' then case when production_window_days = 14 then 1 else 2 end
    when 'bass-v1' then case when production_window_days = 14 then 1 else 2 end
    when 'vocals-v1' then case when production_window_days = 14 then 2 else 4 end
    when 'mix-v1' then case when production_window_days = 14 then 4 else 8 end
    when 'master-v1' then case when production_window_days = 14 then 2 else 4 end
    when 'license-v1' then case when production_window_days = 14 then 2 else 3 end
    when 'cover-art-v1' then case when production_window_days = 14 then 1 else 3 end
    when 'distributor-v1' then 14
    else lead_time_days
  end,
  is_enabled = case when template_step.stable_key = 'distributor-v1' then distributor_enabled else template_step.is_enabled end,
  standard_cost_amount = case when template_step.stable_key = 'distributor-v1' then -10 else template_step.standard_cost_amount end
  where template_step.production_template_id = template_record.id;

  select coalesce(sum(lead_time_days), 0) into configured_production_window_days
  from public.production_template_steps as template_step
  where template_step.production_template_id = template_record.id
    and template_step.step_kind = 'production_step'
    and template_step.semantic_kind <> 'distribution'
    and template_step.is_enabled;
  if configured_production_window_days <> production_window_days then
    raise exception 'The pending workspace Production template cannot be configured to the requested Production window.';
  end if;

  if not exists (
    select 1 from public.production_template_steps
    where production_template_steps.production_template_id = template_record.id
      and production_template_steps.stable_key = 'distributor-v1'
      and production_template_steps.semantic_kind = 'distribution'
      and production_template_steps.lead_time_days = 14
      and production_template_steps.standard_cost_amount = -10
      and production_template_steps.is_enabled = distributor_enabled
  ) then
    raise exception 'The pending workspace Distributor step could not be configured.';
  end if;

  update public.app_workspace_settings
  set
    onboarding_release_frequency = normalized_release_frequency,
    onboarding_distributor_answer = normalized_distributor_answer,
    roadmap_standard_release_cadence_days = release_cadence_days,
    marketing_song_campaign_length_days = song_campaign_length_days,
    marketing_song_campaign_advance_days = song_campaign_advance_days
  where workspace_id = p_workspace_id;
  if not found then
    raise exception 'Workspace settings were not found.';
  end if;

  update public.app_profiles
  set display_name = normalized_display_name
  where id = p_user_id;

  -- This is deliberately the final state-changing write: any failed seeding
  -- aborts the transaction and leaves the workspace pending setup.
  update public.app_workspaces
  set name = normalized_workspace_name, slug = candidate_slug, setup_state = 'active'
  where id = p_workspace_id;

  return query select p_workspace_id, normalized_workspace_name, candidate_slug, 'finalized';
end;
$$;

revoke all on function public.finalize_pending_workspace(uuid, uuid, text, text, text, text) from public;
grant execute on function public.finalize_pending_workspace(uuid, uuid, text, text, text, text) to service_role;

-- V1 completion is an explicit user acknowledgement. Canonical product facts
-- may reach 3/3, but the helper remains visible until Close is chosen.
-- Existing automatic completion rows retain their already-hidden behavior.
update public.app_guidance_program_progress
set dismissed_at = coalesce(dismissed_at, completed_at),
    completed_at = null
where program_key = 'getting_started_v1'
  and completed_at is not null;

create or replace function public.invalidate_getting_started_guidance_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Canonical state is evaluated on every status request. A user dismissal is
  -- durable, so mutable Song/Google facts must not remove the progress row.
  return coalesce(new, old);
end;
$$;

create or replace function public.get_guidance_status(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  program constant text := 'getting_started_v1';
  basics_complete boolean;
  first_song_complete boolean;
  google_youtube_complete boolean;
  skipped_steps jsonb := '{}'::jsonb;
  dismissed_at timestamptz;
  next_step text;
begin
  if not exists (
    select 1 from public.app_workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  ) and auth.role() <> 'service_role' then
    raise exception 'Workspace access denied.';
  end if;

  if not exists (
    select 1 from public.app_workspaces
    where id = p_workspace_id and guidance_eligible_at is not null
  ) then
    return jsonb_build_object('active', false);
  end if;

  insert into public.app_guidance_program_progress (workspace_id, program_key)
  values (p_workspace_id, program)
  on conflict (workspace_id, program_key) do nothing;

  select progress.dismissed_at, progress.skipped_steps
  into dismissed_at, skipped_steps
  from public.app_guidance_program_progress as progress
  where progress.workspace_id = p_workspace_id and progress.program_key = program;

  if dismissed_at is not null then
    return jsonb_build_object('active', false);
  end if;

  select setup_state = 'active' into basics_complete
  from public.app_workspaces where id = p_workspace_id;
  select exists (select 1 from public.production_songs where workspace_id = p_workspace_id)
  into first_song_complete;
  select exists (
    select 1 from public.app_google_connections
    where workspace_id = p_workspace_id
      and youtube_enabled
      and youtube_channel_id is not null
      and btrim(youtube_channel_id) <> ''
  ) into google_youtube_complete;

  next_step := case
    when not basics_complete then 'artistdeck_basics'
    when not first_song_complete and not coalesce((skipped_steps ->> 'first_song')::boolean, false) then 'first_song'
    when not google_youtube_complete and not coalesce((skipped_steps ->> 'google_youtube')::boolean, false) then 'google_youtube'
    else null
  end;

  -- Existing skip behavior remains: if no actionable step remains but the
  -- workspace is not genuinely 3/3, the optional helper disappears.
  if next_step is null and not (basics_complete and first_song_complete and google_youtube_complete) then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'program', program,
    'completed', (case when basics_complete then 1 else 0 end + case when first_song_complete then 1 else 0 end + case when google_youtube_complete then 1 else 0 end),
    'total', 3,
    'nextStep', next_step,
    'steps', jsonb_build_object('artistdeck_basics', basics_complete, 'first_song', first_song_complete, 'google_youtube', google_youtube_complete),
    'skipped', jsonb_build_object('artistdeck_basics', false, 'first_song', coalesce((skipped_steps ->> 'first_song')::boolean, false), 'google_youtube', coalesce((skipped_steps ->> 'google_youtube')::boolean, false))
  );
end;
$$;

create or replace function public.dismiss_getting_started_guidance(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  program constant text := 'getting_started_v1';
begin
  if not exists (
    select 1 from public.app_workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  ) and auth.role() <> 'service_role' then
    raise exception 'Workspace access denied.';
  end if;

  if not exists (
    select 1 from public.app_workspaces
    where id = p_workspace_id and guidance_eligible_at is not null
  ) then
    return jsonb_build_object('active', false);
  end if;

  if not (
    (select setup_state = 'active' from public.app_workspaces where id = p_workspace_id)
    and exists (select 1 from public.production_songs where workspace_id = p_workspace_id)
    and exists (
      select 1 from public.app_google_connections
      where workspace_id = p_workspace_id and youtube_enabled
        and youtube_channel_id is not null and btrim(youtube_channel_id) <> ''
    )
  ) then
    raise exception 'Getting started can be closed only after all canonical steps are complete.';
  end if;

  insert into public.app_guidance_program_progress (workspace_id, program_key, dismissed_at, completed_at)
  values (p_workspace_id, program, now(), null)
  on conflict (workspace_id, program_key) do update
    set dismissed_at = coalesce(app_guidance_program_progress.dismissed_at, excluded.dismissed_at),
        completed_at = null;

  return jsonb_build_object('active', false);
end;
$$;

revoke all on function public.dismiss_getting_started_guidance(uuid) from public, anon, authenticated;
grant execute on function public.dismiss_getting_started_guidance(uuid) to service_role;

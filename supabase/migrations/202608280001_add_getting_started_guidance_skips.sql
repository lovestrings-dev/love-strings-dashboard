-- Explicit Guidance skips are workspace-scoped V1 presentation preferences.
-- They never replace the canonical product completion signals.
alter table public.app_guidance_program_progress
  add column if not exists skipped_steps jsonb not null default '{}'::jsonb
  check (jsonb_typeof(skipped_steps) = 'object');

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

  if exists (
    select 1 from public.app_guidance_program_progress
    where workspace_id = p_workspace_id and program_key = program and completed_at is not null
  ) then
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

  if basics_complete and first_song_complete and google_youtube_complete then
    insert into public.app_guidance_program_progress (workspace_id, program_key, completed_at)
    values (p_workspace_id, program, now())
    on conflict (workspace_id, program_key) do update
      set completed_at = coalesce(app_guidance_program_progress.completed_at, excluded.completed_at);
    return jsonb_build_object('active', false);
  end if;

  insert into public.app_guidance_program_progress (workspace_id, program_key)
  values (p_workspace_id, program)
  on conflict (workspace_id, program_key) do nothing;

  select progress.skipped_steps into skipped_steps
  from public.app_guidance_program_progress as progress
  where progress.workspace_id = p_workspace_id and progress.program_key = program;

  next_step := case
    when not basics_complete then 'artistdeck_basics'
    when not first_song_complete and not coalesce((skipped_steps ->> 'first_song')::boolean, false) then 'first_song'
    when not google_youtube_complete and not coalesce((skipped_steps ->> 'google_youtube')::boolean, false) then 'google_youtube'
    else null
  end;

  if next_step is null then
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

create or replace function public.skip_getting_started_guidance_step(p_workspace_id uuid, p_step text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  program constant text := 'getting_started_v1';
begin
  if p_step not in ('first_song', 'google_youtube') then
    raise exception 'Only actionable getting_started_v1 steps can be skipped.';
  end if;
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

  insert into public.app_guidance_program_progress (workspace_id, program_key, skipped_steps)
  values (p_workspace_id, program, jsonb_build_object(p_step, true))
  on conflict (workspace_id, program_key) do update
    set skipped_steps = app_guidance_program_progress.skipped_steps || jsonb_build_object(p_step, true);

  return public.get_guidance_status(p_workspace_id);
end;
$$;

revoke all on function public.skip_getting_started_guidance_step(uuid, text) from public, anon, authenticated;
grant execute on function public.skip_getting_started_guidance_step(uuid, text) to service_role;

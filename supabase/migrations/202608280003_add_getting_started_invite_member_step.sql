-- The invitation step is completed by a real workspace invitation sent after
-- the workspace entered Guidance. A skip remains a presentation preference.
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
  invite_member_complete boolean;
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
  select exists (
    select 1
    from public.app_workspace_invitations as invitation
    join public.app_workspaces as workspace on workspace.id = invitation.workspace_id
    where invitation.workspace_id = p_workspace_id
      and invitation.created_at >= workspace.guidance_eligible_at
  ) into invite_member_complete;

  next_step := case
    when not basics_complete then 'artistdeck_basics'
    when not first_song_complete and not coalesce((skipped_steps ->> 'first_song')::boolean, false) then 'first_song'
    when not google_youtube_complete and not coalesce((skipped_steps ->> 'google_youtube')::boolean, false) then 'google_youtube'
    when not invite_member_complete and not coalesce((skipped_steps ->> 'invite_member')::boolean, false) then 'invite_member'
    else null
  end;

  if next_step is null and not (basics_complete and first_song_complete and google_youtube_complete and invite_member_complete) then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'program', program,
    'completed', (case when basics_complete then 1 else 0 end + case when first_song_complete then 1 else 0 end + case when google_youtube_complete then 1 else 0 end + case when invite_member_complete then 1 else 0 end),
    'total', 4,
    'nextStep', next_step,
    'steps', jsonb_build_object('artistdeck_basics', basics_complete, 'first_song', first_song_complete, 'google_youtube', google_youtube_complete, 'invite_member', invite_member_complete),
    'skipped', jsonb_build_object('artistdeck_basics', false, 'first_song', coalesce((skipped_steps ->> 'first_song')::boolean, false), 'google_youtube', coalesce((skipped_steps ->> 'google_youtube')::boolean, false), 'invite_member', coalesce((skipped_steps ->> 'invite_member')::boolean, false))
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
  if p_step not in ('first_song', 'google_youtube', 'invite_member') then
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
    and exists (
      select 1
      from public.app_workspace_invitations as invitation
      join public.app_workspaces as workspace on workspace.id = invitation.workspace_id
      where invitation.workspace_id = p_workspace_id
        and invitation.created_at >= workspace.guidance_eligible_at
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

revoke all on function public.skip_getting_started_guidance_step(uuid, text) from public, anon, authenticated;
grant execute on function public.skip_getting_started_guidance_step(uuid, text) to service_role;

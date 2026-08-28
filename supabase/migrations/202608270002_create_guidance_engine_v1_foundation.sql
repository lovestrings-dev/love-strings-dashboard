-- Guidance is workspace-scoped because its completion rules describe shared
-- workspace setup and assets, not an individual member's UI journey.
alter table public.app_workspaces
  add column if not exists guidance_eligible_at timestamptz;

create table public.app_guidance_program_progress (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  program_key text not null,
  first_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, program_key),
  check (program_key ~ '^[a-z0-9_]+_v[0-9]+$')
);

alter table public.app_guidance_program_progress enable row level security;

create trigger app_guidance_program_progress_set_updated_at
before update on public.app_guidance_program_progress
for each row execute function public.set_updated_at();

-- Existing active workspaces deliberately remain ineligible. New workspaces
-- become eligible only when the existing first-admin finalization succeeds.
do $$
declare
  definition text;
  target text := 'set name = normalized_workspace_name, slug = candidate_slug, setup_state = ''active''';
  replacement text := 'set name = normalized_workspace_name, slug = candidate_slug, setup_state = ''active'', guidance_eligible_at = now()';
begin
  select pg_get_functiondef('public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure)
  into definition;
  if position(target in definition) = 0 then
    raise exception 'Could not locate the pending-workspace activation write for guidance eligibility.';
  end if;
  execute replace(definition, target, replacement);
end;
$$;

-- A completion marker is safe only while the canonical mutable signals remain
-- true. These triggers invalidate it before a later status check can reuse it.
create or replace function public.invalidate_getting_started_guidance_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid := coalesce(new.workspace_id, old.workspace_id);
begin
  delete from public.app_guidance_program_progress
  where workspace_id = target_workspace_id
    and program_key = 'getting_started_v1'
    and completed_at is not null;
  return coalesce(new, old);
end;
$$;

create trigger production_songs_invalidate_getting_started_guidance
after delete on public.production_songs
for each row execute function public.invalidate_getting_started_guidance_for_workspace();

create trigger app_google_connections_invalidate_getting_started_guidance
after update or delete on public.app_google_connections
for each row execute function public.invalidate_getting_started_guidance_for_workspace();

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
begin
  -- The API already verifies membership. Keep this guard in the RPC so it is
  -- never a general cross-workspace status oracle.
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

  return jsonb_build_object(
    'active', true,
    'program', program,
    'completed', (
      case when basics_complete then 1 else 0 end +
      case when first_song_complete then 1 else 0 end +
      case when google_youtube_complete then 1 else 0 end
    ),
    'total', 3,
    'nextStep', case
      when not basics_complete then 'artistdeck_basics'
      when not first_song_complete then 'first_song'
      else 'google_youtube'
    end,
    'steps', jsonb_build_object(
      'artistdeck_basics', basics_complete,
      'first_song', first_song_complete,
      'google_youtube', google_youtube_complete
    )
  );
end;
$$;

revoke all on function public.get_guidance_status(uuid) from public, anon, authenticated;
grant execute on function public.get_guidance_status(uuid) to service_role;

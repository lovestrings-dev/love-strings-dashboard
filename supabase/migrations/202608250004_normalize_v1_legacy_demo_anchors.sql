-- Normalize only the approved legacy Demo remnants on V1 songs. The live step
-- primary key stays unchanged, preserving any task and budget relationships.
do $$
declare
  v_bioglycerin_workspace_id uuid;
  v_love_strings_workspace_id uuid;
  v_updated_count integer;
begin
  select id into v_bioglycerin_workspace_id from public.app_workspaces where name = 'BIOGLYCERIN';
  select id into v_love_strings_workspace_id from public.app_workspaces where name = 'Love Strings';

  if v_bioglycerin_workspace_id is null or v_love_strings_workspace_id is null then
    raise exception 'Expected BIOGLYCERIN and Love Strings workspaces were not found.';
  end if;

  if exists (
    select 1
    from public.production_songs song
    join public.production_steps step on step.production_song_id = song.id
    where song.scheduling_model = 'template-v1'
      and (song.workspace_id = v_bioglycerin_workspace_id or (song.workspace_id = v_love_strings_workspace_id and song.release_date >= date '2026-08-25'))
      and (step.stable_key ~* '^demo-' or step.label ~* '^demo$')
      and 1 <> (select count(*) from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step where snapshot_step ->> 'stepKind' = 'idea_anchor')
  ) then
    raise exception 'Legacy Demo repair requires exactly one Idea anchor in each immutable V1 snapshot.';
  end if;

  update public.production_steps step
  set stable_key = 'v1-' || (idea.snapshot_step ->> 'id'),
      label = coalesce(idea.snapshot_step ->> 'displayName', 'Idea'),
      position = (idea.snapshot_step ->> 'position')::integer,
      template_step_id = (idea.snapshot_step ->> 'id')::uuid,
      template_step_stable_key = idea.snapshot_step ->> 'stableKey',
      template_step_kind = idea.snapshot_step ->> 'stepKind',
      template_step_lead_time_days = coalesce((idea.snapshot_step ->> 'leadTimeDays')::integer, 0)
  from public.production_songs song
  cross join lateral (
    select snapshot_step
    from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
    where snapshot_step ->> 'stepKind' = 'idea_anchor'
  ) idea
  where step.production_song_id = song.id
    and song.workspace_id = v_bioglycerin_workspace_id
    and song.scheduling_model = 'template-v1'
    and (step.stable_key ~* '^demo-' or step.label ~* '^demo$');
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 3 then
    raise exception 'BIOGLYCERIN legacy Demo repair expected 3 rows, updated %.', v_updated_count;
  end if;

  update public.production_steps step
  set stable_key = 'v1-' || (idea.snapshot_step ->> 'id'),
      label = coalesce(idea.snapshot_step ->> 'displayName', 'Idea'),
      step_deadline = date '2025-12-15',
      position = (idea.snapshot_step ->> 'position')::integer,
      template_step_id = (idea.snapshot_step ->> 'id')::uuid,
      template_step_stable_key = idea.snapshot_step ->> 'stableKey',
      template_step_kind = idea.snapshot_step ->> 'stepKind',
      template_step_lead_time_days = coalesce((idea.snapshot_step ->> 'leadTimeDays')::integer, 0)
  from public.production_songs song
  cross join lateral (
    select snapshot_step
    from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
    where snapshot_step ->> 'stepKind' = 'idea_anchor'
  ) idea
  where step.production_song_id = song.id
    and song.workspace_id = v_love_strings_workspace_id
    and song.scheduling_model = 'template-v1'
    and song.release_date >= date '2026-08-25'
    and (step.stable_key ~* '^demo-' or step.label ~* '^demo$');
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 21 then
    raise exception 'Love Strings legacy Demo repair expected 21 rows, updated %.', v_updated_count;
  end if;

  if exists (
    select 1
    from public.production_songs song
    join public.production_steps step on step.production_song_id = song.id
    where song.scheduling_model = 'template-v1'
      and (song.workspace_id = v_bioglycerin_workspace_id or (song.workspace_id = v_love_strings_workspace_id and song.release_date >= date '2026-08-25'))
      and (step.stable_key ~* '^demo-' or step.label ~* '^demo$')
  ) then
    raise exception 'Legacy Demo repair left an active V1 Demo remnant.';
  end if;
end;
$$;

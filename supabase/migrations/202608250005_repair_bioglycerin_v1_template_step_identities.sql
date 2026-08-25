-- Restore only the eight missing immutable-snapshot identities on the
-- BIOGLYCERIN Against The Wall live V1 steps. Existing step rows and their
-- relationships stay in place; this never adopts the current workspace template.
do $$
declare
  v_workspace_id uuid;
  v_song_id uuid := '1c8b9641-d23a-43ae-8246-a03e7089c0a5';
  v_updated_count integer;
begin
  select id into v_workspace_id from public.app_workspaces where name = 'BIOGLYCERIN';
  if v_workspace_id is null then
    raise exception 'BIOGLYCERIN workspace was not found.';
  end if;

  if not exists (
    select 1 from public.production_songs
    where id = v_song_id and workspace_id = v_workspace_id and scheduling_model = 'template-v1'
  ) then
    raise exception 'Expected BIOGLYCERIN Against The Wall V1 song was not found.';
  end if;

  if (select count(*) from public.production_steps where production_song_id = v_song_id and template_step_id is null) <> 8 then
    raise exception 'Against The Wall V1 identity repair expected exactly 8 missing standard identities.';
  end if;

  if exists (
    select 1
    from public.production_steps step
    join public.production_songs song on song.id = step.production_song_id
    where step.production_song_id = v_song_id
      and step.template_step_id is null
      and 1 <> (
        select count(*)
        from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
        where snapshot_step ->> 'stepKind' = 'production_step'
          and lower(regexp_replace(snapshot_step ->> 'displayName', '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(step.label, '[^a-z0-9]+', '', 'g'))
      )
  ) then
    raise exception 'Against The Wall V1 identity repair found an ambiguous snapshot match.';
  end if;

  update public.production_steps step
  set template_step_id = (snapshot_step ->> 'id')::uuid,
      template_step_stable_key = snapshot_step ->> 'stableKey',
      template_step_kind = snapshot_step ->> 'stepKind',
      template_step_lead_time_days = coalesce((snapshot_step ->> 'leadTimeDays')::integer, 0),
      template_step_standard_cost_amount = coalesce((snapshot_step ->> 'standardCostAmount')::numeric, 0)
  from public.production_songs song
  cross join lateral jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
  where step.production_song_id = song.id
    and song.id = v_song_id
    and step.template_step_id is null
    and snapshot_step ->> 'stepKind' = 'production_step'
    and lower(regexp_replace(snapshot_step ->> 'displayName', '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(step.label, '[^a-z0-9]+', '', 'g'));
  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 8 then
    raise exception 'Against The Wall V1 identity repair expected 8 rows, updated %.', v_updated_count;
  end if;

  if exists (select 1 from public.production_steps where production_song_id = v_song_id and template_step_id is null) then
    raise exception 'Against The Wall V1 identity repair left a missing standard identity.';
  end if;
end;
$$;

-- Complete the approved Love Strings active V1 migration. Edit is obsolete
-- only when its data is duplicated elsewhere; Keyboard remains a song-local,
-- fixed-date V1 snapshot step and is never added to the workspace template.
do $$
declare
  v_workspace_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_template public.production_templates%rowtype;
  v_template_snapshot jsonb;
  v_target_song_ids constant uuid[] := array[
    '36dd4605-f7f7-422c-9dd2-16499fbd8c50'::uuid,
    '3ce0fb0d-02d2-4ffc-9b0a-72f7b7ffdc8f'::uuid,
    '40d4aa83-a2e3-48c0-bd56-9ab9782a2523'::uuid,
    '704fce81-daa9-47e9-8522-d6474a1e8c2b'::uuid,
    '549ed4af-6288-4649-bc43-942661e11043'::uuid,
    '51722222-8dfa-48b1-8658-8f159ac99b8b'::uuid,
    'e5306342-24d5-466b-94d3-192e0c12edf9'::uuid,
    '538eb093-12d1-4350-ad4b-c1c51bda457a'::uuid,
    '9b90478f-a294-4f38-be93-328ff9703839'::uuid,
    '3ea533dc-8432-4327-a5ba-fe2d748a0f3c'::uuid,
    '8a5c5aba-a616-480b-8a07-ea9b957a098b'::uuid,
    '14cb71a5-68fa-4fe0-b758-601b190d75f6'::uuid,
    'ceb9bb71-4bcd-4fd9-a104-37509cfe866e'::uuid,
    '26098748-de66-4c72-91e7-1bb485b5fe4a'::uuid,
    'dc044da8-edb1-4160-a232-c33e31c2fbee'::uuid,
    'bd100b9c-fe01-4dac-9325-26567898d3ce'::uuid
  ];
begin
  if not exists (select 1 from public.app_workspaces where id = v_workspace_id and name = 'Love Strings') then
    raise exception 'Love Strings workspace preflight failed.';
  end if;
  select * into strict v_template from public.production_templates where workspace_id = v_workspace_id and is_active;
  if v_template.id <> 'cde8dbc7-a4a7-452c-b22e-8a5091490a21'::uuid or v_template.template_version <> 1 then
    raise exception 'Love Strings V1 template preflight failed.';
  end if;
  if (select count(*) from public.production_songs where workspace_id = v_workspace_id) <> 27
     or (select count(*) from public.production_songs where workspace_id = v_workspace_id and scheduling_model = 'template-v1') <> 5
     or (select count(*) from public.production_songs where id = any(v_target_song_ids) and workspace_id = v_workspace_id and scheduling_model = 'legacy-v0' and production_template_id is null and production_template_snapshot is null) <> 16 then
    raise exception 'Love Strings remaining active-song preflight failed.';
  end if;

  -- Each removable Edit row is childless, budgetless, and its note is already
  -- present on another live step of the same song. Any deviation aborts.
  if exists (
    select 1 from public.production_steps as edit_step
    where edit_step.production_song_id = any(v_target_song_ids) and lower(edit_step.label) = 'edit'
      and (
        exists (select 1 from public.production_step_tasks task where task.production_step_id = edit_step.id)
        or exists (select 1 from public.production_budget_lines budget where budget.production_step_id = edit_step.id)
        or (btrim(edit_step.notes) <> '' and not exists (
          select 1 from public.production_steps sibling
          where sibling.production_song_id = edit_step.production_song_id
            and sibling.id <> edit_step.id and sibling.notes = edit_step.notes
        ))
      )
  ) then
    raise exception 'An obsolete Love Strings Edit row contains unique or child data.';
  end if;

  if (select count(*) from public.production_steps where production_song_id = any(v_target_song_ids) and lower(label) = 'keyboard') <> 1
     or exists (
       select 1 from public.production_steps
       where production_song_id = any(v_target_song_ids)
         and lower(label) not in ('demo', 'drums', 'guitars', 'bass', 'vocals', 'mix', 'master', 'license', 'cover art', 'distributor', 'edit', 'keyboard')
     ) then
    raise exception 'Love Strings custom-step preflight failed.';
  end if;

  select jsonb_build_object(
    'schedulingModel', 'template-v1', 'templateId', v_template.id, 'templateVersion', v_template.template_version,
    'releaseAnchor', (select jsonb_build_object('displayName', display_name, 'id', id, 'leadTimeDays', lead_time_days, 'position', position, 'semanticKind', semantic_kind, 'standardCostAmount', standard_cost_amount, 'stableKey', stable_key, 'stepKind', step_kind) from public.production_template_steps where production_template_id = v_template.id and step_kind = 'release_anchor'),
    'steps', (select jsonb_agg(jsonb_build_object('displayName', display_name, 'id', id, 'leadTimeDays', lead_time_days, 'position', position, 'semanticKind', semantic_kind, 'standardCostAmount', standard_cost_amount, 'stableKey', stable_key, 'stepKind', step_kind) order by position) from public.production_template_steps where production_template_id = v_template.id and (step_kind = 'idea_anchor' or (step_kind = 'production_step' and is_enabled)))
  ) into v_template_snapshot;

  delete from public.production_steps
  where production_song_id = any(v_target_song_ids) and lower(label) = 'edit';

  -- Keyboard is retained as a local identity between Mix (500) and Master (600).
  update public.production_steps as step
  set stable_key = 'custom-' || step.id::text,
      template_step_id = null,
      template_step_stable_key = 'custom-' || step.id::text,
      template_step_kind = 'production_step',
      template_step_lead_time_days = null,
      template_step_standard_cost_amount = null,
      position = 550
  where step.production_song_id = any(v_target_song_ids) and lower(step.label) = 'keyboard';

  with mapped_rows as (
    select step.id as step_id, template_step.id as template_step_id, template_step.stable_key,
      template_step.step_kind, template_step.lead_time_days, template_step.standard_cost_amount, template_step.position
    from public.production_steps step
    join public.production_template_steps template_step
      on template_step.production_template_id = v_template.id
     and template_step.stable_key = case lower(step.label)
       when 'demo' then 'anchor-idea-v1' when 'drums' then 'drums-v1' when 'guitars' then 'guitars-v1'
       when 'bass' then 'bass-v1' when 'vocals' then 'vocals-v1' when 'mix' then 'mix-v1'
       when 'master' then 'master-v1' when 'license' then 'license-v1' when 'cover art' then 'cover-art-v1'
       when 'distributor' then 'distributor-v1' end
    where step.production_song_id = any(v_target_song_ids) and lower(step.label) <> 'keyboard'
  )
  update public.production_steps step
  set template_step_id = mapped_rows.template_step_id,
      template_step_stable_key = mapped_rows.stable_key,
      template_step_kind = mapped_rows.step_kind,
      template_step_lead_time_days = mapped_rows.lead_time_days,
      template_step_standard_cost_amount = mapped_rows.standard_cost_amount,
      position = mapped_rows.position
  from mapped_rows where step.id = mapped_rows.step_id;

  update public.production_songs song
  set scheduling_model = 'template-v1', production_template_id = v_template.id,
      production_template_version = v_template.template_version,
      production_template_snapshot = jsonb_set(v_template_snapshot, '{steps}',
        (v_template_snapshot -> 'steps') || coalesce((
          select jsonb_agg(jsonb_build_object(
            'displayName', step.label, 'id', step.stable_key, 'leadTimeDays', 0,
            'position', step.position, 'semanticKind', 'standard', 'standardCostAmount', 0,
            'stableKey', step.stable_key, 'stepKind', 'production_step', 'timingMode', 'fixed'
          ) order by step.position)
          from public.production_steps step
          where step.production_song_id = song.id and lower(step.label) = 'keyboard'
        ), '[]'::jsonb))
  where song.id = any(v_target_song_ids) and song.workspace_id = v_workspace_id;

  if (select count(*) from public.production_songs where workspace_id = v_workspace_id and scheduling_model = 'template-v1') <> 21
     or (select count(*) from public.production_steps where production_song_id = any(v_target_song_ids) and lower(label) = 'edit') <> 0
     or (select count(*) from public.production_steps where production_song_id = any(v_target_song_ids) and lower(label) = 'keyboard' and template_step_id is null and template_step_stable_key like 'custom-%' and template_step_lead_time_days is null) <> 1 then
    raise exception 'Love Strings active V1 completion verification failed.';
  end if;
end;
$$;

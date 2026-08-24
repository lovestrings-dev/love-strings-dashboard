-- Controlled in-place V1 upgrade for the currently template-compatible active
-- Love Strings songs. Historical songs and active songs with custom live
-- workflow rows are deliberately outside this migration.
do $$
declare
  v_workspace_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_template public.production_templates%rowtype;
  v_snapshot jsonb;
  v_target_song_ids constant uuid[] := array[
    '82697ad0-b761-467c-81ae-7accbb12f09a'::uuid,
    '3fcdc29c-847d-4168-87e3-21bfab63eee3'::uuid,
    'f52826e7-a711-459d-b35c-150141d7afcb'::uuid,
    'fbb18fa1-d994-477d-800f-564ca5706aef'::uuid,
    'dd0e6954-6478-489c-a6ff-3018012dc6d8'::uuid
  ];
begin
  if not exists (
    select 1 from public.app_workspaces
    where id = v_workspace_id and name = 'Love Strings'
  ) then
    raise exception 'Love Strings workspace preflight failed.';
  end if;

  select * into strict v_template
  from public.production_templates
  where workspace_id = v_workspace_id and is_active = true;

  if v_template.id <> 'cde8dbc7-a4a7-452c-b22e-8a5091490a21'::uuid
     or v_template.template_version <> 1
     or v_template.scheduling_model <> 'template-v1' then
    raise exception 'Love Strings V1 template preflight failed.';
  end if;

  if (select count(*) from public.production_songs where workspace_id = v_workspace_id) <> 27
     or (select count(*) from public.production_songs where workspace_id = v_workspace_id and scheduling_model = 'legacy-v0') <> 27
     or (select count(*) from public.production_songs where id = any(v_target_song_ids) and workspace_id = v_workspace_id and scheduling_model = 'legacy-v0' and production_template_id is null and production_template_snapshot is null) <> 5 then
    raise exception 'Love Strings target-song preflight failed.';
  end if;

  if (select count(*) from public.production_steps where production_song_id = any(v_target_song_ids)) <> 50
     or exists (
       select 1 from public.production_steps
       where production_song_id = any(v_target_song_ids)
         and lower(label) not in ('demo', 'drums', 'guitars', 'bass', 'vocals', 'mix', 'master', 'license', 'cover art', 'distributor')
     ) then
    raise exception 'Love Strings target workflow preflight failed.';
  end if;

  select jsonb_build_object(
    'schedulingModel', 'template-v1',
    'templateId', v_template.id,
    'templateVersion', v_template.template_version,
    'releaseAnchor', (
      select jsonb_build_object('displayName', display_name, 'id', id, 'leadTimeDays', lead_time_days, 'position', position, 'semanticKind', semantic_kind, 'standardCostAmount', standard_cost_amount, 'stableKey', stable_key, 'stepKind', step_kind)
      from public.production_template_steps
      where production_template_id = v_template.id and step_kind = 'release_anchor'
    ),
    'steps', (
      select jsonb_agg(jsonb_build_object('displayName', display_name, 'id', id, 'leadTimeDays', lead_time_days, 'position', position, 'semanticKind', semantic_kind, 'standardCostAmount', standard_cost_amount, 'stableKey', stable_key, 'stepKind', step_kind) order by position)
      from public.production_template_steps
      where production_template_id = v_template.id
        and (step_kind = 'idea_anchor' or (step_kind = 'production_step' and is_enabled))
    )
  ) into v_snapshot;

  update public.production_songs
  set scheduling_model = 'template-v1',
      production_template_id = v_template.id,
      production_template_version = v_template.template_version,
      production_template_snapshot = v_snapshot
  where id = any(v_target_song_ids) and workspace_id = v_workspace_id;

  with mapped_rows as (
    select step.id as step_id, template_step.id as template_step_id,
      template_step.stable_key, template_step.step_kind,
      template_step.lead_time_days, template_step.standard_cost_amount,
      template_step.position
    from public.production_steps as step
    join public.production_template_steps as template_step
      on template_step.production_template_id = v_template.id
     and template_step.stable_key = case lower(step.label)
       when 'demo' then 'anchor-idea-v1'
       when 'drums' then 'drums-v1'
       when 'guitars' then 'guitars-v1'
       when 'bass' then 'bass-v1'
       when 'vocals' then 'vocals-v1'
       when 'mix' then 'mix-v1'
       when 'master' then 'master-v1'
       when 'license' then 'license-v1'
       when 'cover art' then 'cover-art-v1'
       when 'distributor' then 'distributor-v1'
     end
    where step.production_song_id = any(v_target_song_ids)
  )
  update public.production_steps as step
  set template_step_id = mapped_rows.template_step_id,
      template_step_stable_key = mapped_rows.stable_key,
      template_step_kind = mapped_rows.step_kind,
      template_step_lead_time_days = mapped_rows.lead_time_days,
      template_step_standard_cost_amount = mapped_rows.standard_cost_amount,
      position = mapped_rows.position
  from mapped_rows
  where step.id = mapped_rows.step_id;

  if (select count(*) from public.production_steps where production_song_id = any(v_target_song_ids) and template_step_id is not null) <> 50
     or (select count(*) from public.production_songs where id = any(v_target_song_ids) and scheduling_model = 'template-v1' and production_template_snapshot = v_snapshot) <> 5 then
    raise exception 'Love Strings V1 upgrade verification failed.';
  end if;
end;
$$;

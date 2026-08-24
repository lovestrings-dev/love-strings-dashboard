-- Controlled, one-time conversion of the three approved unfinished BIOGLYCERIN
-- songs to Production Template V1. Every guard is deliberately exact so this
-- migration cannot silently broaden into another workspace or a later song.
do $$
declare
  v_workspace_id constant uuid := 'ef4a53ed-d88c-404a-b1ed-7086a2242e78';
  v_template public.production_templates%rowtype;
  v_snapshot jsonb;
  v_count integer;
begin
  if not exists (
    select 1
    from public.app_workspaces
    where id = v_workspace_id
      and name = 'BIOGLYCERIN'
  ) then
    raise exception 'BIOGLYCERIN pilot workspace preflight failed.';
  end if;

  select * into strict v_template
  from public.production_templates
  where workspace_id = v_workspace_id
    and is_active = true;

  if v_template.id <> '5d7eedb2-53d9-47ec-84f3-a8ba0a29678f'
     or v_template.template_version <> 1
     or v_template.scheduling_model <> 'template-v1' then
    raise exception 'BIOGLYCERIN pilot template preflight failed.';
  end if;

  select count(*) into v_count
  from public.production_template_steps
  where production_template_id = v_template.id;

  if v_count <> 10
     or exists (
       select 1
       from public.production_template_steps
       where production_template_id = v_template.id
         and (
           not is_enabled
           or stable_key not in (
             'anchor-idea-v1', 'drums-v1', 'guitars-v1', 'bass-v1', 'vocals-v1',
             'mix-v1', 'master-v1', 'cover-art-v1', 'distributor-v1',
             'anchor-release-v1'
           )
         )
     )
     or exists (
       select 1
       from public.production_template_steps
       where production_template_id = v_template.id
         and stable_key = 'license-v1'
     )
     or not exists (
       select 1
       from public.production_template_steps
       where production_template_id = v_template.id
         and stable_key = 'anchor-idea-v1'
           and step_kind = 'idea_anchor'
           and semantic_kind = 'standard'
     )
     or not exists (
       select 1
       from public.production_template_steps
       where production_template_id = v_template.id
         and stable_key = 'anchor-release-v1'
           and step_kind = 'release_anchor'
           and semantic_kind = 'standard'
     )
     or not exists (
       select 1
       from public.production_template_steps
       where production_template_id = v_template.id
         and stable_key = 'distributor-v1'
           and step_kind = 'production_step'
           and semantic_kind = 'distribution'
     ) then
    raise exception 'BIOGLYCERIN pilot template-step preflight failed.';
  end if;

  select count(*) into v_count
  from public.production_songs
  where workspace_id = v_workspace_id;

  if v_count <> 3
     or (select count(*) from public.production_songs where id in (
       '31d25a58-a691-4658-bfda-0b4211afab2c',
       '1d7eac1a-39b3-474f-9c17-b66cbc1dff02',
       '1c8b9641-d23a-43ae-8246-a03e7089c0a5'
     ) and workspace_id = v_workspace_id and scheduling_model = 'legacy-v0'
       and production_template_id is null
       and production_template_version is null
       and production_template_snapshot is null) <> 3 then
    raise exception 'BIOGLYCERIN pilot song preflight failed.';
  end if;

  select count(*) into v_count
  from public.production_steps
  where production_song_id in (
    '31d25a58-a691-4658-bfda-0b4211afab2c',
    '1d7eac1a-39b3-474f-9c17-b66cbc1dff02',
    '1c8b9641-d23a-43ae-8246-a03e7089c0a5'
  );

  if v_count <> 27
     or exists (
       select 1
       from public.production_steps
       where production_song_id in (
         '31d25a58-a691-4658-bfda-0b4211afab2c',
         '1d7eac1a-39b3-474f-9c17-b66cbc1dff02',
         '1c8b9641-d23a-43ae-8246-a03e7089c0a5'
       )
         and (
           template_step_id is not null
           or template_step_stable_key is not null
           or template_step_kind is not null
           or template_step_lead_time_days is not null
           or template_step_standard_cost_amount is not null
         )
     ) then
    raise exception 'BIOGLYCERIN pilot step preflight failed.';
  end if;

  -- This is the same immutable structure created by createProductionV1SongSnapshot.
  -- The Release anchor belongs in the snapshot, not as a newly inserted live step.
  select jsonb_build_object(
    'schedulingModel', 'template-v1',
    'templateId', v_template.id,
    'templateVersion', v_template.template_version,
    'releaseAnchor', (
      select jsonb_build_object(
        'displayName', display_name,
        'id', id,
        'leadTimeDays', lead_time_days,
        'position', position,
        'semanticKind', semantic_kind,
        'standardCostAmount', standard_cost_amount,
        'stableKey', stable_key,
        'stepKind', step_kind
      )
      from public.production_template_steps
      where production_template_id = v_template.id
        and step_kind = 'release_anchor'
    ),
    'steps', (
      select jsonb_agg(jsonb_build_object(
        'displayName', display_name,
        'id', id,
        'leadTimeDays', lead_time_days,
        'position', position,
        'semanticKind', semantic_kind,
        'standardCostAmount', standard_cost_amount,
        'stableKey', stable_key,
        'stepKind', step_kind
      ) order by position)
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
  where id in (
    '31d25a58-a691-4658-bfda-0b4211afab2c',
    '1d7eac1a-39b3-474f-9c17-b66cbc1dff02',
    '1c8b9641-d23a-43ae-8246-a03e7089c0a5'
  )
    and workspace_id = v_workspace_id;

  with step_mapping(step_id, production_song_id, template_stable_key) as (
    values
      ('ff8570a7-a07f-4508-9d0f-d230382dbb04'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'anchor-idea-v1'),
      ('1af16128-937b-4bf6-a068-484f3e3aa7fc'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'drums-v1'),
      ('868d588d-ce42-4c5e-9d0a-e6efad4792d2'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'guitars-v1'),
      ('f7ae1d92-a1bc-40a9-8f1d-503cade6a32b'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'bass-v1'),
      ('5f685103-6012-4520-9b76-92271a080466'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'vocals-v1'),
      ('e894e6ee-33f1-42de-9e1d-0e6c4981ae7a'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'mix-v1'),
      ('f96d000f-7ce6-41b6-8d8c-831a8adbfad0'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'master-v1'),
      ('4bfcb882-7857-41a7-96a9-6a28ca059bd0'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'cover-art-v1'),
      ('b5a5cfb3-6c93-411e-9282-7ba6242ebf5f'::uuid, '31d25a58-a691-4658-bfda-0b4211afab2c'::uuid, 'distributor-v1'),
      ('75727781-7237-4b5f-8383-f0420bb4178f'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'anchor-idea-v1'),
      ('2e721dcb-2f19-4c52-9ce6-fd29956a1d37'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'drums-v1'),
      ('f16efdba-713c-4bd2-97bc-2405611ce278'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'guitars-v1'),
      ('0bfb0719-4bf4-4bf9-9b00-73a3b5e8fee0'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'bass-v1'),
      ('8c7e6bab-4049-414d-ad41-65f3b685a307'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'vocals-v1'),
      ('f09baffb-6eae-415a-b81d-c56c646c9656'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'mix-v1'),
      ('933cf8ca-199f-4d7c-879e-1d2a93e94f32'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'master-v1'),
      ('4f790162-17fa-45ef-bba4-cb8cff4d020d'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'cover-art-v1'),
      ('a4dd393a-8af0-43a2-8279-4af81fb26a50'::uuid, '1d7eac1a-39b3-474f-9c17-b66cbc1dff02'::uuid, 'distributor-v1'),
      ('2c83dde8-0d36-48bb-86c8-13f8a9e0f5c3'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'anchor-idea-v1'),
      ('623f8208-2fcb-4093-b56b-e788113bb507'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'drums-v1'),
      ('4710c767-ed1b-4ce1-ab4e-dcce176d85d1'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'guitars-v1'),
      ('1f7ae06f-b616-43db-a1c5-c89b3ae1db45'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'bass-v1'),
      ('b507c54f-331f-4d71-b0a7-3fa55ce2b8e8'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'vocals-v1'),
      ('ce5b5088-e92d-4456-b79c-c91ef6858109'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'mix-v1'),
      ('89f6ab26-9864-4417-8a34-7264d03b9656'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'master-v1'),
      ('8ed0b868-c566-499c-aa86-1a66bbb067b9'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'cover-art-v1'),
      ('607d9600-b4eb-49c7-a322-0afe6d920d76'::uuid, '1c8b9641-d23a-43ae-8246-a03e7089c0a5'::uuid, 'distributor-v1')
  ), mapped_rows as (
    select step_mapping.*, template_step.id as template_step_id,
      template_step.step_kind, template_step.lead_time_days,
      template_step.standard_cost_amount, template_step.position
    from step_mapping
    join public.production_template_steps as template_step
      on template_step.production_template_id = v_template.id
     and template_step.stable_key = step_mapping.template_stable_key
  )
  update public.production_steps as step
  set template_step_id = mapped_rows.template_step_id,
      template_step_stable_key = mapped_rows.template_stable_key,
      template_step_kind = mapped_rows.step_kind,
      template_step_lead_time_days = mapped_rows.lead_time_days,
      template_step_standard_cost_amount = mapped_rows.standard_cost_amount,
      position = mapped_rows.position
  from mapped_rows
  where step.id = mapped_rows.step_id
    and step.production_song_id = mapped_rows.production_song_id;

  if (select count(*) from public.production_steps where production_song_id in (
        '31d25a58-a691-4658-bfda-0b4211afab2c',
        '1d7eac1a-39b3-474f-9c17-b66cbc1dff02',
        '1c8b9641-d23a-43ae-8246-a03e7089c0a5'
      ) and template_step_id is not null) <> 27 then
    raise exception 'BIOGLYCERIN pilot step mapping failed.';
  end if;
end;
$$;

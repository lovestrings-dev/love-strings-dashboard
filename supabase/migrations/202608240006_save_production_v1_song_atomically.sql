-- Identity-preserving save path for template-v1 Production songs.
--
-- Unlike the legacy REST save path, this function updates rows matched by
-- their existing live identities.  All writes happen in one transaction: an
-- error anywhere rolls back the song, steps, tasks, and budget changes.

create or replace function public.save_production_v1_song_atomically(
  p_workspace_id uuid,
  p_song jsonb
)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song_id uuid;
  v_song_slug text;
  v_step jsonb;
  v_task jsonb;
  v_line jsonb;
  v_step_id uuid;
  v_task_id uuid;
  v_line_id uuid;
  v_step_budget_position integer;
  v_task_budget_position integer;
  v_seen_step_ids uuid[] := '{}';
  v_seen_task_ids uuid[] := '{}';
  v_seen_budget_ids uuid[] := '{}';
  v_steps jsonb := coalesce(p_song -> 'steps', '[]'::jsonb);
  v_status text;
begin
  if coalesce(p_song ->> 'schedulingModel', '') <> 'template-v1' then
    raise exception 'This save function only accepts template-v1 songs.';
  end if;

  if jsonb_typeof(v_steps) <> 'array' then
    raise exception 'Production steps must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_steps) as candidate(value)
    group by candidate.value ->> 'id'
    having count(*) > 1 or coalesce(candidate.value ->> 'id', '') = ''
  ) then
    raise exception 'Production step stable keys must be present and unique.';
  end if;

  if coalesce(p_song ->> 'dbId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select production_song.id, production_song.slug
    into v_song_id, v_song_slug
    from public.production_songs as production_song
    where production_song.id = (p_song ->> 'dbId')::uuid
      and production_song.workspace_id = p_workspace_id
      and production_song.scheduling_model = 'template-v1'
    for update;

    if not found then
      raise exception 'Template-v1 production song was not found in the active workspace.';
    end if;

    update public.production_songs
    set
      title = p_song ->> 'title',
      production_deadline = (p_song ->> 'deadline')::date,
      release_date = (p_song ->> 'releaseDate')::date,
      roadmap_phase_id = nullif(p_song ->> 'roadmapPhaseId', ''),
      album_art_url = coalesce(p_song ->> 'albumArtUrl', ''),
      source = 'app',
      production_template_id = (p_song ->> 'productionTemplateId')::uuid,
      production_template_version = (p_song ->> 'productionTemplateVersion')::integer,
      production_template_snapshot = p_song -> 'productionTemplateSnapshot'
    where production_songs.id = v_song_id;
  else
    insert into public.production_songs (
      workspace_id, slug, title, production_deadline, release_date,
      roadmap_phase_id, album_art_url, source, scheduling_model,
      production_template_id, production_template_version,
      production_template_snapshot
    ) values (
      p_workspace_id, p_song ->> 'slug', p_song ->> 'title',
      (p_song ->> 'deadline')::date, (p_song ->> 'releaseDate')::date,
      nullif(p_song ->> 'roadmapPhaseId', ''),
      coalesce(p_song ->> 'albumArtUrl', ''), 'app', 'template-v1',
      (p_song ->> 'productionTemplateId')::uuid,
      (p_song ->> 'productionTemplateVersion')::integer,
      p_song -> 'productionTemplateSnapshot'
    )
    on conflict (workspace_id, slug) do update
    set
      title = excluded.title,
      production_deadline = excluded.production_deadline,
      release_date = excluded.release_date,
      roadmap_phase_id = excluded.roadmap_phase_id,
      album_art_url = excluded.album_art_url,
      production_template_id = excluded.production_template_id,
      production_template_version = excluded.production_template_version,
      production_template_snapshot = excluded.production_template_snapshot
    where production_songs.scheduling_model = 'template-v1'
    returning production_songs.id, production_songs.slug into v_song_id, v_song_slug;

    if v_song_id is null then
      raise exception 'A legacy production song already uses this slug.';
    end if;
  end if;

  update public.marketing_campaigns
  set release_date = (p_song ->> 'releaseDate')::date
  where production_song_id = v_song_id
    and workspace_id = p_workspace_id;

  for v_step in select value from jsonb_array_elements(v_steps) loop
    v_status := coalesce(v_step ->> 'status', 'not-started');
    if v_status not in ('not-started', 'in-progress', 'done') then
      raise exception 'Invalid Production step status.';
    end if;

    select production_step.id into v_step_id
    from public.production_steps as production_step
    where production_step.production_song_id = v_song_id
      and production_step.stable_key = v_step ->> 'id'
    for update;

    if found then
      update public.production_steps
      set
        label = v_step ->> 'label',
        step_deadline = (v_step ->> 'deadline')::date,
        status = v_status,
        notes = coalesce(v_step ->> 'notes', ''),
        position = coalesce((v_step ->> 'position')::integer, 0),
        is_default_step = coalesce((v_step ->> 'isDefaultStep')::boolean, true),
        template_step_id = nullif(v_step ->> 'templateStepId', '')::uuid,
        template_step_stable_key = nullif(v_step ->> 'templateStepStableKey', ''),
        template_step_kind = nullif(v_step ->> 'templateStepKind', ''),
        template_step_lead_time_days = nullif(v_step ->> 'templateStepLeadTimeDays', '')::integer,
        template_step_standard_cost_amount = nullif(v_step ->> 'templateStepStandardCostAmount', '')::numeric
      where production_steps.id = v_step_id;
    else
      insert into public.production_steps (
        production_song_id, stable_key, label, step_deadline, status, notes,
        position, is_default_step, template_step_id, template_step_stable_key,
        template_step_kind, template_step_lead_time_days,
        template_step_standard_cost_amount
      ) values (
        v_song_id, v_step ->> 'id', v_step ->> 'label',
        (v_step ->> 'deadline')::date, v_status, coalesce(v_step ->> 'notes', ''),
        coalesce((v_step ->> 'position')::integer, 0),
        coalesce((v_step ->> 'isDefaultStep')::boolean, true),
        nullif(v_step ->> 'templateStepId', '')::uuid,
        nullif(v_step ->> 'templateStepStableKey', ''),
        nullif(v_step ->> 'templateStepKind', ''),
        nullif(v_step ->> 'templateStepLeadTimeDays', '')::integer,
        nullif(v_step ->> 'templateStepStandardCostAmount', '')::numeric
      ) returning production_steps.id into v_step_id;
    end if;
    v_seen_step_ids := array_append(v_seen_step_ids, v_step_id);

    v_step_budget_position := 0;
    for v_line in select value from jsonb_array_elements(coalesce(v_step -> 'budgetLines', '[]'::jsonb)) loop
      if coalesce(v_line ->> 'description', '') = '' and coalesce((v_line ->> 'amount')::numeric, 0) = 0 then continue; end if;
      v_step_budget_position := v_step_budget_position + 1;
      select budget_line.id into v_line_id
      from public.production_budget_lines as budget_line
      where budget_line.id = case when coalesce(v_line ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_line ->> 'id')::uuid else null end
        and budget_line.production_step_id = v_step_id
      for update;
      if found then
        update public.production_budget_lines set description = coalesce(v_line ->> 'description', ''), amount = coalesce((v_line ->> 'amount')::numeric, 0), budget_bucket = 'production', position = v_step_budget_position where production_budget_lines.id = v_line_id;
      else
        insert into public.production_budget_lines (production_step_id, description, amount, budget_bucket, position)
        values (v_step_id, coalesce(v_line ->> 'description', ''), coalesce((v_line ->> 'amount')::numeric, 0), 'production', v_step_budget_position) returning production_budget_lines.id into v_line_id;
      end if;
      v_seen_budget_ids := array_append(v_seen_budget_ids, v_line_id);
    end loop;

    for v_task in select value from jsonb_array_elements(coalesce(v_step -> 'extraTasks', '[]'::jsonb)) loop
      v_status := coalesce(v_task ->> 'status', 'not-started');
      if v_status not in ('not-started', 'in-progress', 'done') then raise exception 'Invalid Production task status.'; end if;
      select task.id into v_task_id
      from public.production_step_tasks as task
      where task.id = case when coalesce(v_task ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_task ->> 'id')::uuid else null end
        and task.production_step_id = v_step_id
      for update;
      if found then
        update public.production_step_tasks set title = v_task ->> 'title', status = v_status, position = coalesce((v_task ->> 'position')::integer, array_length(v_seen_task_ids, 1) + 1) where production_step_tasks.id = v_task_id;
      else
        insert into public.production_step_tasks (production_step_id, title, status, position)
        values (v_step_id, v_task ->> 'title', v_status, coalesce((v_task ->> 'position')::integer, array_length(v_seen_task_ids, 1) + 1)) returning production_step_tasks.id into v_task_id;
      end if;
      v_seen_task_ids := array_append(v_seen_task_ids, v_task_id);

      v_task_budget_position := 0;
      for v_line in select value from jsonb_array_elements(coalesce(v_task -> 'budgetLines', '[]'::jsonb)) loop
        if coalesce(v_line ->> 'description', '') = '' and coalesce((v_line ->> 'amount')::numeric, 0) = 0 then continue; end if;
        v_task_budget_position := v_task_budget_position + 1;
        select budget_line.id into v_line_id
        from public.production_budget_lines as budget_line
        where budget_line.id = case when coalesce(v_line ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_line ->> 'id')::uuid else null end
          and budget_line.production_step_task_id = v_task_id
        for update;
        if found then
          update public.production_budget_lines set description = coalesce(v_line ->> 'description', ''), amount = coalesce((v_line ->> 'amount')::numeric, 0), budget_bucket = 'production', position = v_task_budget_position where production_budget_lines.id = v_line_id;
        else
          insert into public.production_budget_lines (production_step_task_id, description, amount, budget_bucket, position)
          values (v_task_id, coalesce(v_line ->> 'description', ''), coalesce((v_line ->> 'amount')::numeric, 0), 'production', v_task_budget_position) returning production_budget_lines.id into v_line_id;
        end if;
        v_seen_budget_ids := array_append(v_seen_budget_ids, v_line_id);
      end loop;
    end loop;
  end loop;

  delete from public.production_budget_lines as budget_line
  where (budget_line.production_step_id = any(v_seen_step_ids) or budget_line.production_step_task_id = any(v_seen_task_ids))
    and budget_line.id <> all(v_seen_budget_ids);

  delete from public.production_step_tasks as task
  where task.production_step_id = any(v_seen_step_ids)
    and task.id <> all(v_seen_task_ids);

  delete from public.production_steps as production_step
  where production_step.production_song_id = v_song_id
    and production_step.id <> all(v_seen_step_ids);

  return query select v_song_id as id, v_song_slug as slug;
end;
$$;

revoke all on function public.save_production_v1_song_atomically(uuid, jsonb) from public;
revoke all on function public.save_production_v1_song_atomically(uuid, jsonb) from anon;
revoke all on function public.save_production_v1_song_atomically(uuid, jsonb) from authenticated;
grant execute on function public.save_production_v1_song_atomically(uuid, jsonb) to service_role;

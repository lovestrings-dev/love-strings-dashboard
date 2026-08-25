-- Qualify the active-template column because the creation RPC also returns a
-- column named scheduling_model.
create or replace function public.create_roadmap_aware_production_v1_song(
  p_workspace_id uuid,
  p_title text
)
returns table (
  id uuid,
  slug text,
  title text,
  production_deadline date,
  release_date date,
  roadmap_general_position integer,
  roadmap_phase_id text,
  album_art_url text,
  scheduling_model text,
  production_template_id uuid,
  production_template_version integer,
  production_template_snapshot jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_template public.production_templates%rowtype; v_step public.production_template_steps%rowtype;
  v_song_id uuid; v_slug text; v_release_date date; v_production_deadline date; v_position integer;
  v_workspace_today date; v_cadence_days integer; v_latest_release_date date; v_distribution_position integer;
  v_before_boundary date; v_after_boundary date; v_step_deadline date; v_snapshot jsonb; v_step_id uuid;
begin
  if coalesce(btrim(p_title), '') = '' then raise exception 'Production song title is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));
  select settings.roadmap_standard_release_cadence_days, (now() at time zone coalesce(settings.timezone, 'Europe/Vienna'))::date
  into v_cadence_days, v_workspace_today from public.app_workspace_settings as settings where settings.workspace_id = p_workspace_id for share;
  if not found or v_cadence_days is null or v_cadence_days <= 0 then raise exception 'Roadmap release cadence is unavailable for this workspace.'; end if;
  select * into strict v_template from public.production_templates as template_row
  where template_row.workspace_id = p_workspace_id and template_row.is_active and template_row.scheduling_model = 'template-v1';
  select max(song.release_date), coalesce(max(song.roadmap_general_position), 0) + 1 into v_latest_release_date, v_position
  from public.production_songs as song where song.workspace_id = p_workspace_id;
  v_release_date := greatest(v_workspace_today, coalesce(v_latest_release_date, v_workspace_today)) + v_cadence_days;
  select jsonb_build_object('schedulingModel', 'template-v1', 'templateId', v_template.id, 'templateVersion', v_template.template_version,
    'releaseAnchor', (select jsonb_build_object('displayName', template_step.display_name, 'id', template_step.id, 'leadTimeDays', template_step.lead_time_days, 'position', template_step.position, 'semanticKind', template_step.semantic_kind, 'standardCostAmount', template_step.standard_cost_amount, 'stableKey', template_step.stable_key, 'stepKind', template_step.step_kind) from public.production_template_steps as template_step where template_step.production_template_id = v_template.id and template_step.step_kind = 'release_anchor'),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('displayName', template_step.display_name, 'id', template_step.id, 'leadTimeDays', template_step.lead_time_days, 'position', template_step.position, 'semanticKind', template_step.semantic_kind, 'standardCostAmount', template_step.standard_cost_amount, 'stableKey', template_step.stable_key, 'stepKind', template_step.step_kind) order by template_step.position) from public.production_template_steps as template_step where template_step.production_template_id = v_template.id and (template_step.step_kind = 'idea_anchor' or (template_step.step_kind = 'production_step' and template_step.is_enabled))), '[]'::jsonb)) into v_snapshot;
  select template_step.position into v_distribution_position from public.production_template_steps as template_step where template_step.production_template_id = v_template.id and template_step.step_kind = 'production_step' and template_step.semantic_kind = 'distribution' and template_step.is_enabled;
  v_slug := 'production-song-' || gen_random_uuid()::text;
  insert into public.production_songs (workspace_id, slug, title, production_deadline, release_date, roadmap_general_position, roadmap_phase_id, album_art_url, source, scheduling_model, production_template_id, production_template_version, production_template_snapshot)
  values (p_workspace_id, v_slug, btrim(p_title), v_release_date, v_release_date, v_position, null, '', 'app', 'template-v1', v_template.id, v_template.template_version, v_snapshot) returning production_songs.id into v_song_id;
  v_before_boundary := v_release_date; v_after_boundary := v_release_date; v_production_deadline := v_release_date;
  for v_step in select * from public.production_template_steps as template_step where template_step.production_template_id = v_template.id and (template_step.step_kind = 'idea_anchor' or (template_step.step_kind = 'production_step' and template_step.is_enabled)) order by template_step.position desc loop
    if v_step.step_kind = 'production_step' and v_step.semantic_kind = 'distribution' then v_step_deadline := v_release_date - v_step.lead_time_days; v_before_boundary := v_step_deadline; v_production_deadline := v_step_deadline;
    elsif v_distribution_position is not null and v_step.position > v_distribution_position then v_step_deadline := v_after_boundary - v_step.lead_time_days; v_after_boundary := v_step_deadline;
    else v_step_deadline := v_before_boundary - v_step.lead_time_days; v_before_boundary := v_step_deadline; end if;
    insert into public.production_steps (production_song_id, stable_key, label, step_deadline, status, notes, position, is_default_step, template_step_id, template_step_stable_key, template_step_kind, template_step_lead_time_days, template_step_standard_cost_amount)
    values (v_song_id, 'v1-' || v_step.id::text, v_step.display_name, v_step_deadline, 'not-started', '', v_step.position, true, v_step.id, v_step.stable_key, v_step.step_kind, v_step.lead_time_days, v_step.standard_cost_amount) returning production_steps.id into v_step_id;
    if v_step.standard_cost_amount <> 0 then insert into public.production_budget_lines (production_step_id, description, amount, budget_bucket, position) values (v_step_id, v_step.display_name, v_step.standard_cost_amount, 'production', 1); end if;
  end loop;
  update public.production_songs as song set production_deadline = v_production_deadline where song.id = v_song_id;
  return query select song.id, song.slug, song.title, song.production_deadline, song.release_date, song.roadmap_general_position, song.roadmap_phase_id, song.album_art_url, song.scheduling_model, song.production_template_id, song.production_template_version, song.production_template_snapshot from public.production_songs as song where song.id = v_song_id;
end;
$$;

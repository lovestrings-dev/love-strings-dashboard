-- Song-local custom V1 steps learn their lead time from the saved workflow.
-- This does not alter any workspace template or standard template timing.
create or replace function public.save_production_v1_song_with_derived_custom_timing(
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
begin
  select saved.id, saved.slug into v_song_id, v_song_slug
  from public.save_production_v1_song_atomically(p_workspace_id, p_song) as saved;

  with derived_custom_steps as (
    select custom_step.id,
      greatest(0, (coalesce(next_step.step_deadline, song.release_date) - custom_step.step_deadline))::integer as lead_time_days
    from public.production_steps custom_step
    join public.production_songs song on song.id = custom_step.production_song_id
    left join lateral (
      select later_step.step_deadline
      from public.production_steps later_step
      where later_step.production_song_id = custom_step.production_song_id
        and later_step.position > custom_step.position
      order by later_step.position
      limit 1
    ) next_step on true
    where custom_step.production_song_id = v_song_id
      and custom_step.template_step_id is null
      and custom_step.template_step_stable_key like 'custom-%'
  )
  update public.production_steps step
  set template_step_lead_time_days = derived_custom_steps.lead_time_days
  from derived_custom_steps
  where step.id = derived_custom_steps.id;

  update public.production_songs song
  set production_template_snapshot = jsonb_set(
    song.production_template_snapshot,
    '{steps}',
    (
      select jsonb_agg(
        case
          when snapshot_step ->> 'id' = custom_step.stable_key then
            jsonb_set(
              jsonb_set(snapshot_step, '{leadTimeDays}', to_jsonb(custom_step.template_step_lead_time_days)),
              '{timingMode}', '"derived"'::jsonb
            )
          else snapshot_step
        end
        order by (snapshot_step ->> 'position')::integer
      )
      from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
      left join public.production_steps custom_step
        on custom_step.production_song_id = song.id
       and custom_step.template_step_id is null
       and custom_step.stable_key = snapshot_step ->> 'id'
       and custom_step.template_step_stable_key like 'custom-%'
    )
  )
  where song.id = v_song_id;

  return query select v_song_id, v_song_slug;
end;
$$;

revoke all on function public.save_production_v1_song_with_derived_custom_timing(uuid, jsonb) from public;
revoke all on function public.save_production_v1_song_with_derived_custom_timing(uuid, jsonb) from anon;
revoke all on function public.save_production_v1_song_with_derived_custom_timing(uuid, jsonb) from authenticated;
grant execute on function public.save_production_v1_song_with_derived_custom_timing(uuid, jsonb) to service_role;

-- Approved initial baseline for the one existing custom row. It retains its
-- identity and current deadline; only its song-local timing metadata changes.
update public.production_steps
set template_step_lead_time_days = 2
where id = 'b206166d-33a1-4ceb-a32b-93933a61be8b'::uuid
  and production_song_id = '36dd4605-f7f7-422c-9dd2-16499fbd8c50'::uuid
  and template_step_id is null
  and template_step_stable_key like 'custom-%';

update public.production_songs song
set production_template_snapshot = jsonb_set(
  song.production_template_snapshot,
  '{steps}',
  (
    select jsonb_agg(
      case when snapshot_step ->> 'id' = 'custom-b206166d-33a1-4ceb-a32b-93933a61be8b'
        then jsonb_set(jsonb_set(snapshot_step, '{leadTimeDays}', '2'::jsonb), '{timingMode}', '"derived"'::jsonb)
        else snapshot_step end
      order by (snapshot_step ->> 'position')::integer
    )
    from jsonb_array_elements(song.production_template_snapshot -> 'steps') snapshot_step
  )
)
where song.id = '36dd4605-f7f7-422c-9dd2-16499fbd8c50'::uuid
  and scheduling_model = 'template-v1';

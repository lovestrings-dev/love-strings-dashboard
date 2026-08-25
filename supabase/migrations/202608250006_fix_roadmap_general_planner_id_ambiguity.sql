-- The RPC returns `id`, which is also a production_songs column. Qualify every
-- production_songs source alias inside the function to prevent PL/pgSQL output
-- variables from shadowing table columns during V1 planner mutations.
create or replace function public.apply_roadmap_general_plan(p_workspace_id uuid, p_songs jsonb)
returns table (id uuid, release_date date, roadmap_general_position integer)
language plpgsql security definer set search_path = public as $$
declare song jsonb; song_id uuid; song_model text;
begin
  if jsonb_typeof(p_songs) <> 'array' or jsonb_array_length(p_songs) = 0 then raise exception 'Roadmap plan updates must be a non-empty array.'; end if;
  if exists (select 1 from jsonb_array_elements(p_songs) item group by item ->> 'dbId' having count(*) > 1 or coalesce(item ->> 'dbId', '') = '') then raise exception 'Roadmap plan updates require unique song IDs.'; end if;
  if exists (select 1 from jsonb_array_elements(p_songs) item left join public.production_songs song_row on song_row.id = (item ->> 'dbId')::uuid where song_row.id is null or song_row.workspace_id <> p_workspace_id) then raise exception 'Roadmap song was not found in workspace.'; end if;

  update public.production_songs song_row
  set roadmap_general_position = song_row.roadmap_general_position + 1000000
  where song_row.workspace_id = p_workspace_id and song_row.id in (select (item ->> 'dbId')::uuid from jsonb_array_elements(p_songs) item);

  for song in select value from jsonb_array_elements(p_songs) loop
    song_id := (song ->> 'dbId')::uuid;
    select song_row.scheduling_model into song_model from public.production_songs song_row where song_row.id = song_id for update;
    if song_model = 'template-v1' and coalesce((song ->> 'isChanged')::boolean, false) then
      perform public.save_production_v1_song_with_derived_custom_timing(p_workspace_id, song);
    elsif song_model <> 'template-v1' and coalesce((song ->> 'isChanged')::boolean, false) then
      update public.production_songs song_row set release_date = (song ->> 'releaseDate')::date, production_deadline = (song ->> 'deadline')::date, roadmap_general_position = (song ->> 'roadmapGeneralPosition')::integer where song_row.id = song_id and song_row.workspace_id = p_workspace_id;
      update public.marketing_campaigns campaign set release_date = (song ->> 'releaseDate')::date where campaign.production_song_id = song_id and campaign.workspace_id = p_workspace_id;
    end if;
    update public.production_songs song_row set roadmap_general_position = (song ->> 'roadmapGeneralPosition')::integer where song_row.id = song_id and song_row.workspace_id = p_workspace_id;
  end loop;
  return query select song_row.id, song_row.release_date, song_row.roadmap_general_position from public.production_songs song_row where song_row.workspace_id = p_workspace_id and song_row.id in (select (item ->> 'dbId')::uuid from jsonb_array_elements(p_songs) item) order by song_row.roadmap_general_position;
end;
$$;

revoke all on function public.apply_roadmap_general_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_roadmap_general_plan(uuid, jsonb) to service_role;

-- Atomic persistence boundary for General Roadmap Planner V1.
-- The API calculates V1 schedules from immutable snapshots, then this function
-- saves the complete changed region as one transaction.

create or replace function public.apply_roadmap_general_plan(
  p_workspace_id uuid,
  p_songs jsonb
)
returns table (id uuid, release_date date, roadmap_general_position integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  song jsonb;
  song_id uuid;
  song_model text;
begin
  if jsonb_typeof(p_songs) <> 'array' or jsonb_array_length(p_songs) = 0 then
    raise exception 'Roadmap plan updates must be a non-empty array.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_songs) item
    group by item ->> 'dbId'
    having count(*) > 1 or coalesce(item ->> 'dbId', '') = ''
  ) then
    raise exception 'Roadmap plan updates require unique song IDs.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_songs) item
    left join public.production_songs song on song.id = (item ->> 'dbId')::uuid
    where song.id is null or song.workspace_id <> p_workspace_id
  ) then
    raise exception 'Roadmap song was not found in workspace.';
  end if;

  -- Avoid transient unique-position collisions while the canonical order moves.
  update public.production_songs song
  set roadmap_general_position = song.roadmap_general_position + 1000000
  where song.workspace_id = p_workspace_id
    and song.id in (select (item ->> 'dbId')::uuid from jsonb_array_elements(p_songs) item);

  for song in select value from jsonb_array_elements(p_songs) loop
    song_id := (song ->> 'dbId')::uuid;
    select scheduling_model into song_model from public.production_songs where id = song_id for update;

    if song_model = 'template-v1' and coalesce((song ->> 'isChanged')::boolean, false) then
      perform public.save_production_v1_song_with_derived_custom_timing(p_workspace_id, song);
    elsif song_model <> 'template-v1' and coalesce((song ->> 'isChanged')::boolean, false) then
      update public.production_songs
      set
        release_date = (song ->> 'releaseDate')::date,
        production_deadline = (song ->> 'deadline')::date,
        roadmap_general_position = (song ->> 'roadmapGeneralPosition')::integer
      where id = song_id and workspace_id = p_workspace_id;

      update public.marketing_campaigns
      set release_date = (song ->> 'releaseDate')::date
      where production_song_id = song_id and workspace_id = p_workspace_id;
    end if;

    update public.production_songs
    set roadmap_general_position = (song ->> 'roadmapGeneralPosition')::integer
    where id = song_id and workspace_id = p_workspace_id;
  end loop;

  return query
  select song.id, song.release_date, song.roadmap_general_position
  from public.production_songs song
  where song.workspace_id = p_workspace_id
    and song.id in (select (item ->> 'dbId')::uuid from jsonb_array_elements(p_songs) item)
  order by song.roadmap_general_position;
end;
$$;

revoke all on function public.apply_roadmap_general_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_roadmap_general_plan(uuid, jsonb) to service_role;

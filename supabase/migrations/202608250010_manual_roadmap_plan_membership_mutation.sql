create or replace function public.mutate_manual_roadmap_plan_membership(
  p_workspace_id uuid,
  p_plan_id text,
  p_action text,
  p_song_id uuid,
  p_direction integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position integer;
  v_target_song_id uuid;
  v_target_position integer;
begin
  if not exists (
    select 1 from public.roadmap_planning_instances
    where id = p_plan_id and workspace_id = p_workspace_id and plan_type = 'manual'
  ) then raise exception 'Manual roadmap plan was not found.'; end if;

  if p_action = 'add' then
    insert into public.roadmap_planning_instance_songs (planning_instance_id, production_song_id, workspace_id)
    values (p_plan_id, p_song_id, p_workspace_id) on conflict do nothing;
    return;
  elsif p_action = 'remove' then
    delete from public.roadmap_planning_instance_songs
    where planning_instance_id = p_plan_id and production_song_id = p_song_id and workspace_id = p_workspace_id;
    return;
  elsif p_action <> 'move' or p_direction not in (-1, 1) then
    raise exception 'Invalid Manual roadmap membership operation.';
  end if;

  select local_position into v_position from public.roadmap_planning_instance_songs
  where planning_instance_id = p_plan_id and production_song_id = p_song_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Song is not in this Manual roadmap plan.'; end if;
  select production_song_id, local_position into v_target_song_id, v_target_position
  from public.roadmap_planning_instance_songs
  where planning_instance_id = p_plan_id and workspace_id = p_workspace_id
    and local_position = (select local_position from public.roadmap_planning_instance_songs where planning_instance_id = p_plan_id and workspace_id = p_workspace_id and local_position < v_position order by local_position desc limit 1)
  limit 1;
  if p_direction = 1 then
    select production_song_id, local_position into v_target_song_id, v_target_position
    from public.roadmap_planning_instance_songs where planning_instance_id = p_plan_id and workspace_id = p_workspace_id and local_position > v_position order by local_position limit 1;
  end if;
  if v_target_song_id is null then return; end if;
  update public.roadmap_planning_instance_songs set local_position = local_position + 1000000
  where planning_instance_id = p_plan_id and workspace_id = p_workspace_id and production_song_id in (p_song_id, v_target_song_id);
  update public.roadmap_planning_instance_songs set local_position = v_target_position where planning_instance_id = p_plan_id and production_song_id = p_song_id and workspace_id = p_workspace_id;
  update public.roadmap_planning_instance_songs set local_position = v_position where planning_instance_id = p_plan_id and production_song_id = v_target_song_id and workspace_id = p_workspace_id;
end;
$$;

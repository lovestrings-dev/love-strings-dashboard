-- A song may be in one Auto plan, while Manual Collection memberships remain
-- genuinely many-to-many and independently ordered.
create or replace function public.enforce_one_auto_plan_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_type text;
begin
  select instance.plan_type into v_plan_type
  from public.roadmap_planning_instances as instance
  where instance.id = new.planning_instance_id
    and instance.workspace_id = new.workspace_id;

  if v_plan_type = 'auto' and exists (
    select 1
    from public.roadmap_planning_instance_songs as membership
    join public.roadmap_planning_instances as instance
      on instance.id = membership.planning_instance_id
     and instance.workspace_id = membership.workspace_id
    where membership.workspace_id = new.workspace_id
      and membership.production_song_id = new.production_song_id
      and instance.plan_type = 'auto'
      and membership.planning_instance_id <> new.planning_instance_id
  ) then
    raise exception 'A Production song may belong to only one Auto plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists roadmap_planning_instance_songs_one_auto_plan on public.roadmap_planning_instance_songs;
create trigger roadmap_planning_instance_songs_one_auto_plan
before insert or update of planning_instance_id, workspace_id, production_song_id
on public.roadmap_planning_instance_songs
for each row execute function public.enforce_one_auto_plan_membership();

-- `roadmap_phase_id` is the legacy/UI projection of an Auto-plan membership.
-- Replace any existing Auto membership before creating its selected phase
-- membership, without touching Manual Collection memberships.
create or replace function public.sync_legacy_song_roadmap_phase_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' or new.roadmap_phase_id is distinct from old.roadmap_phase_id then
    delete from public.roadmap_planning_instance_songs as membership
    using public.roadmap_planning_instances as instance
    where membership.planning_instance_id = instance.id
      and membership.workspace_id = new.workspace_id
      and membership.production_song_id = new.id
      and instance.workspace_id = new.workspace_id
      and instance.plan_type = 'auto';

    if new.roadmap_phase_id is not null then
      insert into public.roadmap_planning_instance_songs (
        planning_instance_id, production_song_id, workspace_id, local_position
      ) values (
        new.roadmap_phase_id, new.id, new.workspace_id, null
      )
      on conflict (planning_instance_id, production_song_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

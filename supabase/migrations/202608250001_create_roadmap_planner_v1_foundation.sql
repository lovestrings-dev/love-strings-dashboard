-- Roadmap Planner V1 foundation.
--
-- The existing roadmap_phases table remains the compatibility surface for the
-- current UI. Planning instances and memberships are the additive V1 model.
-- Legacy phase changes are mirrored into Auto planning instances while the UI
-- is staged over to the new model.

alter table public.app_workspace_settings
  add column if not exists roadmap_standard_release_cadence_days integer not null default 30;

alter table public.app_workspace_settings
  drop constraint if exists app_workspace_settings_roadmap_standard_release_cadence_days_check;

alter table public.app_workspace_settings
  add constraint app_workspace_settings_roadmap_standard_release_cadence_days_check
  check (roadmap_standard_release_cadence_days > 0);

alter table public.production_songs
  add column if not exists roadmap_general_position integer;

with ordered_songs as (
  select
    id,
    row_number() over (
      partition by workspace_id
      order by release_date asc, created_at asc, id asc
    )::integer as roadmap_general_position
  from public.production_songs
)
update public.production_songs as song
set roadmap_general_position = ordered_songs.roadmap_general_position
from ordered_songs
where song.id = ordered_songs.id
  and song.roadmap_general_position is null;

alter table public.production_songs
  alter column roadmap_general_position set not null;

alter table public.production_songs
  add constraint production_songs_workspace_roadmap_general_position_key
  unique (workspace_id, roadmap_general_position);

alter table public.production_songs
  add constraint production_songs_id_workspace_key unique (id, workspace_id);

create table public.roadmap_planning_instances (
  id text primary key,
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  plan_type text not null,
  title text not null,
  description text not null default '',
  timeframe_start date,
  timeframe_end date,
  display_position integer not null default 0,
  phase_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plan_type in ('auto', 'manual')),
  check (timeframe_end is null or timeframe_start is null or timeframe_end >= timeframe_start),
  check (phase_number is null or phase_number > 0),
  unique (id, workspace_id)
);

create index roadmap_planning_instances_workspace_position_idx
  on public.roadmap_planning_instances (workspace_id, display_position, created_at, id);

create index roadmap_planning_instances_workspace_type_idx
  on public.roadmap_planning_instances (workspace_id, plan_type);

create table public.roadmap_planning_instance_songs (
  planning_instance_id text not null,
  production_song_id uuid not null,
  workspace_id uuid not null,
  local_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (planning_instance_id, production_song_id),
  foreign key (planning_instance_id, workspace_id)
    references public.roadmap_planning_instances (id, workspace_id)
    on delete cascade,
  foreign key (production_song_id, workspace_id)
    references public.production_songs (id, workspace_id)
    on delete cascade,
  check (local_position is null or local_position > 0)
);

create unique index roadmap_planning_instance_songs_manual_position_key
  on public.roadmap_planning_instance_songs (planning_instance_id, local_position)
  where local_position is not null;

create index roadmap_planning_instance_songs_workspace_song_idx
  on public.roadmap_planning_instance_songs (workspace_id, production_song_id);

create trigger roadmap_planning_instances_set_updated_at
before update on public.roadmap_planning_instances
for each row execute function public.set_updated_at();

create trigger roadmap_planning_instance_songs_set_updated_at
before update on public.roadmap_planning_instance_songs
for each row execute function public.set_updated_at();

create or replace function public.enforce_roadmap_planning_instance_type_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_type is distinct from old.plan_type then
    raise exception 'Roadmap planning instance type is immutable.';
  end if;

  return new;
end;
$$;

create trigger roadmap_planning_instances_plan_type_immutable
before update of plan_type on public.roadmap_planning_instances
for each row execute function public.enforce_roadmap_planning_instance_type_immutable();

create or replace function public.enforce_roadmap_planning_instance_song_ordering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_type text;
begin
  select plan_type into instance_type
  from public.roadmap_planning_instances
  where id = new.planning_instance_id
    and workspace_id = new.workspace_id
  for update;

  if not found then
    raise exception 'Roadmap planning instance was not found in workspace.';
  end if;

  if instance_type = 'auto' then
    if new.local_position is not null then
      raise exception 'Auto planning instances use General Roadmap ordering and cannot store a local position.';
    end if;
    return new;
  end if;

  if new.local_position is null then
    select coalesce(max(local_position), 0) + 1 into new.local_position
    from public.roadmap_planning_instance_songs
    where planning_instance_id = new.planning_instance_id;
  end if;

  return new;
end;
$$;

create trigger roadmap_planning_instance_songs_validate_ordering
before insert or update of planning_instance_id, workspace_id, local_position
on public.roadmap_planning_instance_songs
for each row execute function public.enforce_roadmap_planning_instance_song_ordering();

create or replace function public.sync_legacy_roadmap_phase_planning_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.roadmap_planning_instances
    where id = old.id and workspace_id = old.workspace_id;
    return old;
  end if;

  insert into public.roadmap_planning_instances (
    id, workspace_id, plan_type, title, description, timeframe_start,
    timeframe_end, display_position, phase_number
  ) values (
    new.id, new.workspace_id, 'auto', new.title, new.description,
    new.start_month, new.end_month, new.position, new.phase_number
  )
  on conflict (id) do update
  set
    workspace_id = excluded.workspace_id,
    title = excluded.title,
    description = excluded.description,
    timeframe_start = excluded.timeframe_start,
    timeframe_end = excluded.timeframe_end,
    display_position = excluded.display_position,
    phase_number = excluded.phase_number;

  return new;
end;
$$;

create trigger roadmap_phases_sync_planning_instance
after insert or update or delete on public.roadmap_phases
for each row execute function public.sync_legacy_roadmap_phase_planning_instance();

insert into public.roadmap_planning_instances (
  id, workspace_id, plan_type, title, description, timeframe_start,
  timeframe_end, display_position, phase_number
)
select
  phase.id,
  phase.workspace_id,
  'auto',
  phase.title,
  phase.description,
  phase.start_month,
  phase.end_month,
  phase.position,
  phase.phase_number
from public.roadmap_phases as phase
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  title = excluded.title,
  description = excluded.description,
  timeframe_start = excluded.timeframe_start,
  timeframe_end = excluded.timeframe_end,
  display_position = excluded.display_position,
  phase_number = excluded.phase_number;

insert into public.roadmap_planning_instance_songs (
  planning_instance_id, production_song_id, workspace_id, local_position
)
select
  song.roadmap_phase_id,
  song.id,
  song.workspace_id,
  null
from public.production_songs as song
where song.roadmap_phase_id is not null
on conflict (planning_instance_id, production_song_id) do nothing;

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
    using public.roadmap_phases as phase
    where membership.planning_instance_id = phase.id
      and membership.workspace_id = new.workspace_id
      and membership.production_song_id = new.id
      and phase.workspace_id = new.workspace_id;

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

create trigger production_songs_sync_legacy_roadmap_phase_membership
after insert or update of roadmap_phase_id on public.production_songs
for each row execute function public.sync_legacy_song_roadmap_phase_membership();

alter table public.roadmap_planning_instances enable row level security;
alter table public.roadmap_planning_instance_songs enable row level security;

create policy "Workspace members can read roadmap planning instances"
on public.roadmap_planning_instances
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read roadmap planning instance songs"
on public.roadmap_planning_instance_songs
for select to authenticated
using (public.is_workspace_member(workspace_id));

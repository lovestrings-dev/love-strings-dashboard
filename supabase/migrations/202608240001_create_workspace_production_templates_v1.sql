-- Workspace-defined Production Template V1 foundation.
--
-- This migration is additive. Existing production songs and steps remain
-- legacy-v0 instances; no existing Production, Marketing, Roadmap, or Budget
-- record is updated, deleted, regenerated, or relinked here.

create table public.production_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  name text not null default 'Production template',
  template_version integer not null default 1 check (template_version > 0),
  scheduling_model text not null default 'template-v1'
    check (scheduling_model = 'template-v1'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_version)
);

create unique index production_templates_one_active_per_workspace_idx
  on public.production_templates (workspace_id)
  where is_active;

create table public.production_template_steps (
  id uuid primary key default gen_random_uuid(),
  production_template_id uuid not null references public.production_templates(id) on delete cascade,
  stable_key text not null,
  display_name text not null,
  position integer not null,
  step_kind text not null
    check (step_kind in ('idea_anchor', 'production_step', 'release_anchor')),
  semantic_kind text not null default 'standard'
    check (semantic_kind in ('standard', 'distribution')),
  is_enabled boolean not null default true,
  -- The number of calendar days between this step and the next later boundary.
  -- For a distribution step, this is its lead time before the Release anchor.
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  standard_cost_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_template_id, stable_key),
  unique (production_template_id, position),
  check (
    (step_kind = 'production_step')
    or (semantic_kind = 'standard' and is_enabled)
  )
);

create unique index production_template_steps_one_idea_anchor_idx
  on public.production_template_steps (production_template_id)
  where step_kind = 'idea_anchor';

create unique index production_template_steps_one_release_anchor_idx
  on public.production_template_steps (production_template_id)
  where step_kind = 'release_anchor';

create index production_template_steps_template_position_idx
  on public.production_template_steps (production_template_id, position);

create index production_template_steps_distribution_idx
  on public.production_template_steps (production_template_id)
  where semantic_kind = 'distribution' and is_enabled;

create trigger production_templates_set_updated_at
before update on public.production_templates
for each row execute function public.set_updated_at();

create trigger production_template_steps_set_updated_at
before update on public.production_template_steps
for each row execute function public.set_updated_at();

-- Anchor identity is structural rather than display-label-based. The trigger
-- protects the required lifecycle anchors from normal template edits; the
-- workspace/template cascade remains available for workspace deletion.
create or replace function public.protect_production_template_anchor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.step_kind in ('idea_anchor', 'release_anchor') then
    if pg_trigger_depth() = 1 then
      raise exception 'Production template lifecycle anchors cannot be deleted.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.step_kind in ('idea_anchor', 'release_anchor')
     and new.step_kind is distinct from old.step_kind then
    raise exception 'Production template lifecycle anchor kind cannot change.';
  end if;

  return new;
end;
$$;

create trigger production_template_steps_protect_anchors
before update or delete on public.production_template_steps
for each row execute function public.protect_production_template_anchor();

-- Create the initial V1 template without coupling its schedule identity to a
-- display label. The default timing is one internally consistent backward
-- chain derived from the current release-relative workflow.
create or replace function public.create_workspace_production_template_v1(
  p_workspace_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_license_cost numeric(12, 2) := -20;
  v_distributor_cost numeric(12, 2) := -10;
  v_cost_defaults jsonb;
begin
  select production_step_cost_defaults
  into v_cost_defaults
  from public.app_workspace_settings
  where workspace_id = p_workspace_id;

  if coalesce(v_cost_defaults ->> 'license', '') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_license_cost := -abs((v_cost_defaults ->> 'license')::numeric);
  end if;
  if coalesce(v_cost_defaults ->> 'distributor', '') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_distributor_cost := -abs((v_cost_defaults ->> 'distributor')::numeric);
  end if;

  insert into public.production_templates (
    workspace_id, name, template_version, scheduling_model, is_active
  ) values (
    p_workspace_id, 'Production template', 1, 'template-v1', true
  )
  on conflict (workspace_id, template_version) do update
    set workspace_id = excluded.workspace_id
  returning id into v_template_id;

  insert into public.production_template_steps (
    production_template_id, stable_key, display_name, position, step_kind,
    semantic_kind, is_enabled, lead_time_days, standard_cost_amount
  ) values
    (v_template_id, 'anchor-idea-v1', 'Idea', 0, 'idea_anchor', 'standard', true, 0, 0),
    (v_template_id, 'drums-v1', 'Drums', 100, 'production_step', 'standard', true, 2, 0),
    (v_template_id, 'guitars-v1', 'Guitars', 200, 'production_step', 'standard', true, 2, 0),
    (v_template_id, 'bass-v1', 'Bass', 300, 'production_step', 'standard', true, 2, 0),
    (v_template_id, 'vocals-v1', 'Vocals', 400, 'production_step', 'standard', true, 3, 0),
    (v_template_id, 'mix-v1', 'Mix', 500, 'production_step', 'standard', true, 7, 0),
    (v_template_id, 'master-v1', 'Master', 600, 'production_step', 'standard', true, 3, 0),
    (v_template_id, 'license-v1', 'License', 700, 'production_step', 'standard', true, 3, v_license_cost),
    (v_template_id, 'cover-art-v1', 'Cover Art', 800, 'production_step', 'standard', true, 3, 0),
    (v_template_id, 'distributor-v1', 'Distributor', 900, 'production_step', 'distribution', true, 14, v_distributor_cost),
    (v_template_id, 'anchor-release-v1', 'Release', 1000, 'release_anchor', 'standard', true, 0, 0)
  on conflict (production_template_id, stable_key) do nothing;

  return v_template_id;
end;
$$;

revoke all on function public.create_workspace_production_template_v1(uuid) from public;
revoke all on function public.create_workspace_production_template_v1(uuid) from anon;
revoke all on function public.create_workspace_production_template_v1(uuid) from authenticated;
grant execute on function public.create_workspace_production_template_v1(uuid) to service_role;

-- New workspaces already create app_workspace_settings during provisioning.
-- Seeding the template from that insert keeps V1 defaults workspace-scoped.
create or replace function public.seed_workspace_production_template_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_workspace_production_template_v1(new.workspace_id);
  return new;
end;
$$;

create trigger app_workspace_settings_seed_production_template_v1
after insert on public.app_workspace_settings
for each row execute function public.seed_workspace_production_template_v1();

-- Seed every existing workspace once. This writes only the new template tables
-- and reads existing cost defaults; it does not touch live Production records.
select public.create_workspace_production_template_v1(workspace.id)
from public.app_workspaces as workspace
where not exists (
  select 1
  from public.production_templates as template
  where template.workspace_id = workspace.id
    and template.template_version = 1
);

alter table public.production_songs
  add column scheduling_model text not null default 'legacy-v0'
    check (scheduling_model in ('legacy-v0', 'template-v1')),
  add column production_template_id uuid references public.production_templates(id) on delete restrict,
  add column production_template_version integer,
  add column production_template_snapshot jsonb;

alter table public.production_songs
  add constraint production_songs_template_snapshot_check
  check (
    (scheduling_model = 'legacy-v0'
      and production_template_id is null
      and production_template_version is null
      and production_template_snapshot is null)
    or
    (scheduling_model = 'template-v1'
      and production_template_id is not null
      and production_template_version is not null
      and production_template_version > 0
      and jsonb_typeof(production_template_snapshot) = 'object')
  );

alter table public.production_steps
  add column template_step_id uuid,
  add column template_step_stable_key text,
  add column template_step_kind text
    check (template_step_kind in ('idea_anchor', 'production_step', 'release_anchor')),
  add column template_step_lead_time_days integer
    check (template_step_lead_time_days is null or template_step_lead_time_days >= 0),
  add column template_step_standard_cost_amount numeric(12, 2);

create index production_songs_template_snapshot_idx
  on public.production_songs (workspace_id, scheduling_model, production_template_id);

create index production_steps_template_step_snapshot_idx
  on public.production_steps (template_step_id)
  where template_step_id is not null;

alter table public.production_templates enable row level security;
alter table public.production_template_steps enable row level security;

create policy "Workspace members can read production templates"
on public.production_templates
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read production template steps"
on public.production_template_steps
for select to authenticated
using (exists (
  select 1
  from public.production_templates template
  where template.id = production_template_id
    and public.is_workspace_member(template.workspace_id)
));

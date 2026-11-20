-- Disposable Smart Links test bootstrap.
--
-- This is deliberately not a repository migration. It reproduces only the
-- pre-existing schema contract consumed by the Phase 1A and Phase 1B Smart
-- Links migrations, so the isolated CI database does not replay production
-- data-reconciliation migrations. The local Supabase stack supplies auth,
-- anon, authenticated, and service_role roles.
\set ON_ERROR_STOP on

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.app_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  access_state text not null default 'active'
    check (access_state in ('active', 'frozen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_workspace_members (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.app_workspace_settings (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  timezone text not null default 'Europe/Vienna',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_songs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  slug text not null,
  title text not null,
  production_deadline date not null,
  release_date date not null,
  roadmap_general_position integer not null,
  album_art_url text not null default '',
  source text not null default 'app',
  scheduling_model text not null default 'legacy-v0'
    check (scheduling_model in ('legacy-v0', 'template-v1')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  unique (workspace_id, roadmap_general_position),
  unique (id, workspace_id)
);

create or replace function public.is_workspace_member(
  check_workspace_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.app_workspace_members
    where workspace_id = check_workspace_id
      and user_id = check_user_id
  );
$$;

alter table public.app_workspaces enable row level security;
alter table public.app_workspace_members enable row level security;
alter table public.app_workspace_settings enable row level security;
alter table public.production_songs enable row level security;

create policy "Test workspace members can read workspaces"
on public.app_workspaces for select to authenticated
using (public.is_workspace_member(id));

create policy "Test workspace members can read memberships"
on public.app_workspace_members for select to authenticated
using (user_id = auth.uid());

create policy "Test workspace members can read settings"
on public.app_workspace_settings for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Test workspace members can read production songs"
on public.production_songs for select to authenticated
using (public.is_workspace_member(workspace_id));

create trigger test_app_workspaces_set_updated_at
before update on public.app_workspaces
for each row execute function public.set_updated_at();

create trigger test_app_workspace_settings_set_updated_at
before update on public.app_workspace_settings
for each row execute function public.set_updated_at();

create trigger test_production_songs_set_updated_at
before update on public.production_songs
for each row execute function public.set_updated_at();

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;

insert into public.app_workspaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Love Strings', 'love-strings');

insert into public.app_workspace_settings (workspace_id, timezone)
values ('00000000-0000-0000-0000-000000000001', 'Europe/Vienna');

commit;

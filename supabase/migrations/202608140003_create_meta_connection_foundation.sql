-- Durable, service-role-only Meta authorization records. `platform_accounts`
-- remains the canonical analytics identity registry; the mapping table records
-- how a Meta authorization discovered each account.

insert into public.platforms (slug, name, category)
values
  ('facebook', 'Facebook', 'social'),
  ('threads', 'Threads', 'social')
on conflict (slug) do update
set name = excluded.name, category = excluded.category;

create table public.app_meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  provider text not null default 'meta' check (provider = 'meta'),
  app_kind text not null check (app_kind in ('creator_social', 'fstats_login')),
  authorization_user_external_id text,
  connected_by uuid not null references auth.users(id) on delete restrict,
  encrypted_token_payload text not null,
  token_type text not null,
  token_expires_at timestamptz,
  token_refreshed_at timestamptz,
  granted_scopes text[] not null default '{}'::text[],
  connection_state text not null default 'connected' check (connection_state in ('connected', 'no_data', 'reauthorization_required', 'degraded')),
  reauthorization_required_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_error_summary is null or char_length(last_error_summary) <= 500)
);

alter table public.app_meta_connections
  add constraint app_meta_connections_workspace_app_subject_key
  unique (workspace_id, app_kind, authorization_user_external_id);
create index app_meta_connections_workspace_state_idx
  on public.app_meta_connections (workspace_id, connection_state);
create index app_meta_connections_token_expiry_idx
  on public.app_meta_connections (token_expires_at)
  where token_expires_at is not null;
-- Generic legacy external IDs are not yet globally unique. Meta writes use this
-- dedicated canonical ID column, leaving legacy collectors untouched.
alter table public.platform_accounts add column meta_external_id text;
create unique index platform_accounts_workspace_platform_meta_external_id_key
  on public.platform_accounts (workspace_id, platform_id, meta_external_id)
  where meta_external_id is not null;

create trigger app_meta_connections_set_updated_at
before update on public.app_meta_connections
for each row execute function public.set_updated_at();

-- One canonical platform account can be found by both Meta app kinds without
-- duplicating its stable external identity. Parent links model Page -> Instagram.
create table public.app_meta_connection_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  connection_id uuid not null references public.app_meta_connections(id) on delete cascade,
  platform_account_id uuid not null references public.platform_accounts(id) on delete cascade,
  account_type text not null check (account_type in ('instagram_professional', 'threads_profile', 'facebook_page')),
  parent_platform_account_id uuid references public.platform_accounts(id) on delete set null,
  is_selected boolean not null default false,
  asset_state text not null default 'discovered' check (asset_state in ('discovered', 'selected', 'disabled', 'degraded')),
  last_successful_sync_at timestamptz,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, platform_account_id),
  check (parent_platform_account_id is null or parent_platform_account_id <> platform_account_id),
  check (last_error_summary is null or char_length(last_error_summary) <= 500)
);

create unique index app_meta_connection_accounts_selected_kind_key
  on public.app_meta_connection_accounts (connection_id, account_type)
  where is_selected;
create index app_meta_connection_accounts_workspace_account_idx
  on public.app_meta_connection_accounts (workspace_id, platform_account_id);
create index app_meta_connection_accounts_connection_state_idx
  on public.app_meta_connection_accounts (connection_id, asset_state);

create trigger app_meta_connection_accounts_set_updated_at
before update on public.app_meta_connection_accounts
for each row execute function public.set_updated_at();

alter table public.app_meta_connections enable row level security;
alter table public.app_meta_connection_accounts enable row level security;

-- Tokens and authorization identity are intentionally service-role only.
revoke all on table public.app_meta_connections from public, anon, authenticated;
revoke all on table public.app_meta_connection_accounts from public, anon, authenticated;

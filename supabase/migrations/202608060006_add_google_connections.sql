-- Store one encrypted Google authorization grant for independently enabled services.
-- The table is service-role only because even encrypted OAuth tokens should not reach browsers.

create table public.app_google_connections (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  connected_by uuid not null references auth.users(id) on delete restrict,
  google_account_email text not null,
  google_account_subject text not null,
  encrypted_refresh_token text not null,
  granted_scopes text[] not null default '{}'::text[],
  youtube_enabled boolean not null default false,
  youtube_channel_id text,
  youtube_channel_title text,
  analytics_enabled boolean not null default false,
  analytics_property_id text,
  analytics_property_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_google_connections enable row level security;

create trigger app_google_connections_set_updated_at
before update on public.app_google_connections
for each row execute function public.set_updated_at();


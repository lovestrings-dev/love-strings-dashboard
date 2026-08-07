-- Provision independent workspaces without relying on a special default tenant.

create table public.app_platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_platform_operators enable row level security;

-- Explicit one-time bootstrap of the existing platform owner. This does not
-- derive future platform authority from any workspace role.
insert into public.app_platform_operators (user_id)
select id
from auth.users
where lower(email) = 'dimasounder@gmail.com'
on conflict (user_id) do nothing;

alter table public.roadmap_phases alter column workspace_id drop default;
alter table public.production_songs alter column workspace_id drop default;
alter table public.marketing_campaigns alter column workspace_id drop default;
alter table public.event_locations alter column workspace_id drop default;
alter table public.events alter column workspace_id drop default;
alter table public.budget_entries alter column workspace_id drop default;
alter table public.budget_hidden_generated_entries alter column workspace_id drop default;
alter table public.focus_other_tasks alter column workspace_id drop default;
alter table public.focus_daily_progress alter column workspace_id drop default;
alter table public.qr_links alter column workspace_id drop default;
alter table public.platform_accounts alter column workspace_id drop default;
alter table public.content_posts alter column workspace_id drop default;
alter table public.platform_metric_snapshots alter column workspace_id drop default;
alter table public.songs alter column workspace_id drop default;
alter table public.releases alter column workspace_id drop default;
alter table public.import_logs alter column workspace_id drop default;

create or replace function public.provision_workspace(
  p_name text,
  p_slug text,
  p_initial_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.app_workspaces (name, slug)
  values (p_name, p_slug)
  returning id into new_workspace_id;

  insert into public.app_workspace_settings (workspace_id)
  values (new_workspace_id);

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, p_initial_owner_id, 'owner');

  insert into public.dashboard_preferences (workspace_id, user_id)
  values (new_workspace_id, p_initial_owner_id);

  return new_workspace_id;
end;
$$;

revoke all on function public.provision_workspace(text, text, uuid) from public;
grant execute on function public.provision_workspace(text, text, uuid) to service_role;

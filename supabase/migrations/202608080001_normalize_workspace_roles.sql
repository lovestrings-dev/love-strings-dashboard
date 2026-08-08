-- Workspace roles are Admin, Member, and Viewer. Platform authority remains
-- exclusively in app_platform_operators and is never inferred from membership.

begin;

do $$
declare
  migrated_memberships integer;
begin
  update public.app_workspace_members
  set role = 'admin'
  where role = 'owner';

  get diagnostics migrated_memberships = row_count;
  raise notice 'Migrated % workspace owner memberships to admin.', migrated_memberships;
end;
$$;

update public.app_workspace_invitations
set role = 'admin'
where role = 'owner';

alter table public.app_workspace_members
drop constraint if exists app_workspace_members_role_check;

alter table public.app_workspace_members
add constraint app_workspace_members_role_check
check (role in ('admin', 'member', 'viewer'));

alter table public.app_workspace_invitations
drop constraint if exists app_workspace_invitations_role_check;

alter table public.app_workspace_invitations
add constraint app_workspace_invitations_role_check
check (role in ('admin', 'member', 'viewer'));

create or replace function public.is_workspace_administrator(
  check_workspace_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_workspace_members
    where workspace_id = check_workspace_id
      and user_id = check_user_id
      and role = 'admin'
  );
$$;

drop function if exists public.is_workspace_owner(uuid, uuid);

-- PostgreSQL does not permit renaming an input parameter through CREATE OR
-- REPLACE. This function is service-role-only, so recreate it atomically with
-- the normalized parameter name and role.
drop function public.provision_workspace(text, text, uuid);

create function public.provision_workspace(
  p_name text,
  p_slug text,
  p_initial_admin_id uuid
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
  values (new_workspace_id, p_initial_admin_id, 'admin');

  insert into public.dashboard_preferences (workspace_id, user_id)
  values (new_workspace_id, p_initial_admin_id);

  return new_workspace_id;
end;
$$;

revoke all on function public.provision_workspace(text, text, uuid) from public;
revoke all on function public.provision_workspace(text, text, uuid) from anon;
revoke all on function public.provision_workspace(text, text, uuid) from authenticated;
grant execute on function public.provision_workspace(text, text, uuid) to service_role;

commit;

-- Add a workspace-scoped administrator role. Assignment remains server-side:
-- the auth enrolment trigger intentionally does not accept `admin` metadata.

alter table public.app_workspace_members
drop constraint if exists app_workspace_members_role_check;

alter table public.app_workspace_members
add constraint app_workspace_members_role_check
check (role in ('owner', 'admin', 'member', 'viewer'));

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
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_workspace_administrator(uuid, uuid) to authenticated;

alter table public.app_workspaces
add column if not exists access_state text not null default 'active';

alter table public.app_workspaces
drop constraint if exists app_workspaces_access_state_check;

alter table public.app_workspaces
add constraint app_workspaces_access_state_check
check (access_state in ('active', 'frozen'));

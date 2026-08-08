-- Membership changes are performed by server-only service-role routes, but the
-- database must still reject any mutation that would leave a workspace without
-- an Admin. Locking the workspace row serializes concurrent admin demotions
-- and removals for the same workspace.

create or replace function public.prevent_last_workspace_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    perform 1
    from public.app_workspaces
    where id = old.workspace_id
    for update;

    if not exists (
      select 1
      from public.app_workspace_members
      where workspace_id = old.workspace_id
        and user_id <> old.user_id
        and role = 'admin'
    ) then
      raise exception 'A workspace must retain at least one Admin.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_last_workspace_admin_removal() from public;
revoke all on function public.prevent_last_workspace_admin_removal() from anon;
revoke all on function public.prevent_last_workspace_admin_removal() from authenticated;

drop trigger if exists app_workspace_members_require_admin on public.app_workspace_members;
create trigger app_workspace_members_require_admin
before update of role or delete on public.app_workspace_members
for each row execute function public.prevent_last_workspace_admin_removal();

-- Preserve the last-Admin invariant for a live workspace, while allowing the
-- membership cascade that follows deletion of the parent workspace itself.

create or replace function public.prevent_last_workspace_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.app_workspaces
    where id = old.workspace_id
  ) then
    return old;
  end if;

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

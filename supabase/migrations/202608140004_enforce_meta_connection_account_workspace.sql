-- Enforce the tenant boundary even for service-role callers: a mapping cannot
-- join a Meta connection or parent/platform account from another workspace.

create function public.enforce_meta_connection_account_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_meta_connections connection
    where connection.id = new.connection_id
      and connection.workspace_id = new.workspace_id
  ) then
    raise exception 'Meta connection must belong to the mapping workspace.';
  end if;

  if not exists (
    select 1 from public.platform_accounts account
    where account.id = new.platform_account_id
      and account.workspace_id = new.workspace_id
  ) then
    raise exception 'Meta platform account must belong to the mapping workspace.';
  end if;

  if new.parent_platform_account_id is not null and not exists (
    select 1 from public.platform_accounts parent_account
    where parent_account.id = new.parent_platform_account_id
      and parent_account.workspace_id = new.workspace_id
  ) then
    raise exception 'Meta parent account must belong to the mapping workspace.';
  end if;

  return new;
end;
$$;

create trigger app_meta_connection_accounts_require_workspace_match
before insert or update of workspace_id, connection_id, platform_account_id, parent_platform_account_id
on public.app_meta_connection_accounts
for each row execute function public.enforce_meta_connection_account_workspace();

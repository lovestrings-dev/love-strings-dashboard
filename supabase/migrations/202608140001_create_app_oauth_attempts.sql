-- Short-lived, provider-neutral OAuth attempts. These bind a callback to the
-- user and workspace that started it without relying on the active-workspace
-- browser cookie at callback time.

create table public.app_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_kind text not null check (integration_kind ~ '^[a-z0-9][a-z0-9:_-]{0,99}$'),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  return_path text not null check (return_path like '/%' and return_path not like '//%'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index app_oauth_attempts_pending_expiry_idx
  on public.app_oauth_attempts (expires_at)
  where consumed_at is null;

alter table public.app_oauth_attempts enable row level security;

-- The service-role-only RPC locks the attempt before checking and consuming it,
-- making a callback state single-use even if two callbacks arrive together.
create function public.consume_app_oauth_attempt(
  p_state_hash text,
  p_integration_kind text,
  p_user_id uuid,
  p_required_workspace_role text default 'member'
)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  integration_kind text,
  return_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.app_oauth_attempts%rowtype;
begin
  if p_required_workspace_role not in ('admin', 'member') then
    raise exception 'Unsupported workspace role requirement.';
  end if;

  select * into attempt
  from public.app_oauth_attempts
  where state_hash = p_state_hash
  for update;

  if not found
    or attempt.consumed_at is not null
    or attempt.expires_at <= now()
    or attempt.integration_kind <> p_integration_kind
    or attempt.user_id <> p_user_id then
    return;
  end if;

  if not exists (
    select 1
    from public.app_workspace_members membership
    where membership.workspace_id = attempt.workspace_id
      and membership.user_id = p_user_id
      and (
        p_required_workspace_role = 'member'
        or membership.role = 'admin'
      )
  ) then
    return;
  end if;

  update public.app_oauth_attempts
  set consumed_at = now()
  where id = attempt.id;

  return query
  select
    attempt.id,
    attempt.workspace_id,
    attempt.user_id,
    attempt.integration_kind,
    attempt.return_path;
end;
$$;

revoke all on table public.app_oauth_attempts from public;
revoke all on table public.app_oauth_attempts from anon;
revoke all on table public.app_oauth_attempts from authenticated;
revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from public;
revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from anon;
revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from authenticated;
grant execute on function public.consume_app_oauth_attempt(text, text, uuid, text) to service_role;

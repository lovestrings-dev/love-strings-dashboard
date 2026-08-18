-- Correct the Batch 0 consumption RPC without changing its contract or grants.
-- Output-column names in RETURNS TABLE are PL/pgSQL variables, so table fields
-- must be explicitly qualified inside the function body.

create or replace function public.consume_app_oauth_attempt(
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
  from public.app_oauth_attempts as oauth_attempt
  where oauth_attempt.state_hash = p_state_hash
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

  update public.app_oauth_attempts as oauth_attempt
  set consumed_at = now()
  where oauth_attempt.id = attempt.id;

  return query
  select
    attempt.id,
    attempt.workspace_id,
    attempt.user_id,
    attempt.integration_kind,
    attempt.return_path;
end;
$$;

revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from public;
revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from anon;
revoke all on function public.consume_app_oauth_attempt(text, text, uuid, text) from authenticated;
grant execute on function public.consume_app_oauth_attempt(text, text, uuid, text) to service_role;

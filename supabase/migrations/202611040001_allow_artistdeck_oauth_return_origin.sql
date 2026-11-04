-- Add the primary custom domain without invalidating existing OAuth attempts.
-- Keep this exact-origin list aligned with lib/oauth-attempt.ts.
begin;

alter table public.app_oauth_attempts
  drop constraint app_oauth_attempts_return_origin_check;

alter table public.app_oauth_attempts
  add constraint app_oauth_attempts_return_origin_check
  check (
    return_origin is null
    or return_origin in (
      'http://localhost:3000',
      'https://love-strings-dashboard.vercel.app',
      'https://www.artistdeck.app'
    )
  );

-- Server-owned provider context travels with the one-time attempt, never in
-- cross-domain cookies. Existing attempts keep an empty context.
alter table public.app_oauth_attempts
  add column context jsonb not null default '{}'::jsonb
  check (jsonb_typeof(context) = 'object');

-- PostgreSQL requires recreating a function when its return row shape changes.
drop function public.consume_app_oauth_attempt_for_fixed_callback(text, text);

create function public.consume_app_oauth_attempt_for_fixed_callback(
  p_state_hash text,
  p_integration_kind text
)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  integration_kind text,
  return_origin text,
  return_path text,
  context jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.app_oauth_attempts%rowtype;
begin
  select * into attempt
  from public.app_oauth_attempts as oauth_attempt
  where oauth_attempt.state_hash = p_state_hash
  for update;

  if not found
    or attempt.consumed_at is not null
    or attempt.expires_at <= now()
    or attempt.integration_kind <> p_integration_kind
    or attempt.return_origin is null then
    return;
  end if;

  if not exists (
    select 1
    from public.app_workspace_members membership
    where membership.workspace_id = attempt.workspace_id
      and membership.user_id = attempt.user_id
      and (
        attempt.required_workspace_role = 'member'
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
    attempt.return_origin,
    attempt.return_path,
    attempt.context;
end;
$$;

revoke all on function public.consume_app_oauth_attempt_for_fixed_callback(text, text) from public;
revoke all on function public.consume_app_oauth_attempt_for_fixed_callback(text, text) from anon;
revoke all on function public.consume_app_oauth_attempt_for_fixed_callback(text, text) from authenticated;
grant execute on function public.consume_app_oauth_attempt_for_fixed_callback(text, text) to service_role;

commit;

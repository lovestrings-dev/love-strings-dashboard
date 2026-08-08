-- Output-column names in the first acceptance function conflicted with
-- unqualified conflict targets. Recreate it with named primary-key targets so
-- acceptance remains atomic on both fresh and already-migrated databases.

create or replace function public.accept_workspace_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns table (
  workspace_id uuid,
  workspace_role text,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.app_workspace_invitations%rowtype;
begin
  select *
  into invitation
  from public.app_workspace_invitations
  where token_hash = p_token_hash
  for update;

  if not found or invitation.email <> lower(p_email) then
    return query select null::uuid, null::text, 'invalid';
    return;
  end if;

  if invitation.revoked_at is not null then
    return query select null::uuid, null::text, 'revoked';
    return;
  end if;

  if invitation.expires_at <= now() then
    return query select null::uuid, null::text, 'expired';
    return;
  end if;

  if invitation.accepted_by is not null and invitation.accepted_by <> p_user_id then
    return query select null::uuid, null::text, 'already_accepted';
    return;
  end if;

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, p_user_id, invitation.role)
  on conflict on constraint app_workspace_members_pkey do nothing;

  insert into public.dashboard_preferences (workspace_id, user_id)
  values (invitation.workspace_id, p_user_id)
  on conflict on constraint dashboard_preferences_pkey do nothing;

  if invitation.accepted_at is null then
    update public.app_workspace_invitations
    set accepted_at = now(), accepted_by = p_user_id
    where id = invitation.id;
  end if;

  return query select invitation.workspace_id, invitation.role, 'accepted';
end;
$$;

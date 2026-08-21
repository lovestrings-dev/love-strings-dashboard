-- Correct output-variable ambiguity in the initial staging function.
create or replace function public.create_provisional_workspace_admin_invitation(
  p_created_by uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz default (now() + interval '14 days')
)
returns table (workspace_id uuid, invitation_id uuid, expires_at timestamptz, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  staged_workspace_id uuid;
  inserted_expires_at timestamptz;
  existing_invitation record;
begin
  if normalized_email = '' or p_token_hash = '' then
    raise exception 'A recipient email and invitation token are required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(normalized_email));

  select i.id, i.workspace_id, i.expires_at
  into existing_invitation
  from public.app_workspace_invitations i
  join public.app_workspaces w on w.id = i.workspace_id
  where i.email = normalized_email
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and w.setup_state = 'pending_setup'
  order by i.created_at desc
  limit 1;

  if found then
    return query select existing_invitation.workspace_id, existing_invitation.id,
      existing_invitation.expires_at, false;
    return;
  end if;

  staged_workspace_id := gen_random_uuid();
  insert into public.app_workspaces (id, name, slug, setup_state)
  values (staged_workspace_id, 'Pending workspace',
    'pending-' || replace(staged_workspace_id::text, '-', ''), 'pending_setup');
  insert into public.app_workspace_settings (workspace_id) values (staged_workspace_id);
  insert into public.app_workspace_invitations as invitation (
    workspace_id, email, role, token_hash, expires_at, created_by
  ) values (
    staged_workspace_id, normalized_email, 'admin', p_token_hash, p_expires_at, p_created_by
  ) returning invitation.id, invitation.expires_at into invitation_id, inserted_expires_at;

  workspace_id := staged_workspace_id;
  expires_at := inserted_expires_at;
  created := true;
  return next;
end;
$$;

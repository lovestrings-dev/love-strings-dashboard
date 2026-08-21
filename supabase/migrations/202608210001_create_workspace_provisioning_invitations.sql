-- Workspace provisioning invitations are intentionally separate from ordinary
-- workspace-member invitations: no workspace exists until a recipient accepts
-- one of these invitations through the service-role-only operation below.

create table public.app_workspace_provisioning_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  provisioned_workspace_id uuid references public.app_workspaces(id) on delete restrict,
  check (
    (accepted_at is null and accepted_by_user_id is null and provisioned_workspace_id is null)
    or
    (accepted_at is not null and accepted_by_user_id is not null and provisioned_workspace_id is not null)
  )
);

create index app_workspace_provisioning_invitations_created_by_idx
  on public.app_workspace_provisioning_invitations (created_by, created_at desc);

create index app_workspace_provisioning_invitations_pending_email_idx
  on public.app_workspace_provisioning_invitations (email, created_at desc)
  where accepted_at is null and revoked_at is null;

alter table public.app_workspace_provisioning_invitations enable row level security;

revoke all on table public.app_workspace_provisioning_invitations from anon;
revoke all on table public.app_workspace_provisioning_invitations from authenticated;

-- The future API route must first verify the Supabase session. This function
-- independently loads that user's Auth email so neither an email nor profile
-- values supplied by a browser can be used as authorization evidence.
create function public.accept_workspace_provisioning_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_display_name text,
  p_workspace_name text
)
returns table (
  workspace_id uuid,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.app_workspace_provisioning_invitations%rowtype;
  authenticated_email text;
  normalized_display_name text := btrim(coalesce(p_display_name, ''));
  normalized_workspace_name text := btrim(coalesce(p_workspace_name, ''));
  base_slug text;
  candidate_slug text;
  candidate_number integer;
  new_workspace_id uuid;
begin
  select lower(email)
  into authenticated_email
  from auth.users
  where id = p_user_id;

  if not found or authenticated_email is null then
    return query select null::uuid, 'invalid';
    return;
  end if;

  select *
  into invitation
  from public.app_workspace_provisioning_invitations
  where token_hash = p_token_hash
  for update;

  if not found or invitation.email <> authenticated_email then
    return query select null::uuid, 'invalid';
    return;
  end if;

  if invitation.revoked_at is not null then
    return query select null::uuid, 'revoked';
    return;
  end if;

  if invitation.expires_at <= now() then
    return query select null::uuid, 'expired';
    return;
  end if;

  if invitation.accepted_at is not null then
    if invitation.accepted_by_user_id <> p_user_id then
      return query select null::uuid, 'already_accepted';
      return;
    end if;

    return query select invitation.provisioned_workspace_id, 'accepted';
    return;
  end if;

  if char_length(normalized_display_name) < 1 or char_length(normalized_display_name) > 120 then
    return query select null::uuid, 'invalid_profile';
    return;
  end if;

  if char_length(normalized_workspace_name) < 2 or char_length(normalized_workspace_name) > 120 then
    return query select null::uuid, 'invalid_workspace_name';
    return;
  end if;

  -- Keep names human-readable, while making the technical slug ASCII-safe.
  base_slug := trim(both '-' from regexp_replace(lower(normalized_workspace_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;
  base_slug := left(base_slug, 80);
  base_slug := trim(trailing '-' from base_slug);
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  -- The unique index remains the concurrency guard. Each attempted insert is
  -- conflict-safe, so simultaneously accepted distinct invitations cannot pick
  -- the same slug.
  for candidate_number in 1..1000 loop
    if candidate_number = 1 then
      candidate_slug := base_slug;
    else
      candidate_slug := left(base_slug, 80 - char_length(candidate_number::text) - 1)
        || '-' || candidate_number::text;
    end if;

    insert into public.app_workspaces (name, slug)
    values (normalized_workspace_name, candidate_slug)
    on conflict (slug) do nothing
    returning id into new_workspace_id;

    exit when new_workspace_id is not null;
  end loop;

  if new_workspace_id is null then
    raise exception 'Could not generate a unique workspace slug.';
  end if;

  insert into public.app_workspace_settings (workspace_id)
  values (new_workspace_id);

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, p_user_id, 'admin');

  insert into public.dashboard_preferences (workspace_id, user_id)
  values (new_workspace_id, p_user_id);

  insert into public.app_profiles (id, display_name)
  values (p_user_id, normalized_display_name)
  on conflict (id) do update
  set display_name = excluded.display_name;

  update public.app_workspace_provisioning_invitations
  set accepted_at = now(),
      accepted_by_user_id = p_user_id,
      provisioned_workspace_id = new_workspace_id
  where id = invitation.id;

  return query select new_workspace_id, 'accepted';
end;
$$;

revoke all on function public.accept_workspace_provisioning_invitation(text, uuid, text, text) from public;
revoke all on function public.accept_workspace_provisioning_invitation(text, uuid, text, text) from anon;
revoke all on function public.accept_workspace_provisioning_invitation(text, uuid, text, text) from authenticated;
grant execute on function public.accept_workspace_provisioning_invitation(text, uuid, text, text) to service_role;

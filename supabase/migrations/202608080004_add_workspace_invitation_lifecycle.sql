-- Invitations retain their acceptance audit trail. Revocation is a separate
-- terminal state so tokens are unusable without deleting historical metadata.

alter table public.app_workspace_invitations
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete restrict;

drop index if exists public.app_workspace_invitations_pending_email_workspace_key;
create unique index app_workspace_invitations_pending_email_workspace_key
on public.app_workspace_invitations (workspace_id, email)
where accepted_at is null and revoked_at is null;

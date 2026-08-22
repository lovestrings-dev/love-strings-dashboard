-- Retire the superseded special workspace-provisioning flow. New workspace
-- administrators now use a provisional workspace plus an ordinary invitation.
drop function if exists public.accept_workspace_provisioning_invitation(text, uuid, text, text);
drop table if exists public.app_workspace_provisioning_invitations;

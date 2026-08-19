// Legacy reference ID used only by the not-yet-multi-workspace scheduled metrics
// collector. It is never used to resolve an authenticated user's active workspace.
export const defaultWorkspaceId = "00000000-0000-0000-0000-000000000001";
export const activeWorkspaceCookieName = "ls_active_workspace";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseWorkspaceId(value?: string | null) {
  return value && uuidPattern.test(value) ? value.toLowerCase() : null;
}

type WorkspaceMembership = {
  workspace_id: string;
};

export function resolveWorkspaceMembership<T extends WorkspaceMembership>(
  memberships: readonly T[] | null | undefined,
  requestedWorkspaceId?: string | null
) {
  const requestedMembership = requestedWorkspaceId
    ? memberships?.find((membership) => membership.workspace_id === requestedWorkspaceId)
    : undefined;

  return requestedMembership ?? memberships?.[0] ?? null;
}

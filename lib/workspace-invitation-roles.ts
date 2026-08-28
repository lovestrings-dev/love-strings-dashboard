import type { WorkspaceRole } from "@/lib/server/workspace-owner";

// Ordinary workspace Admins may add collaborators, but cannot create another
// administrator. Initial Admin provisioning remains a separate owner-only flow.
export function isWorkspaceAdminInviteRole(role: WorkspaceRole) {
  return role === "member" || role === "viewer";
}

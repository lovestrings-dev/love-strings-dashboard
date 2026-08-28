import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isGettingStartedV1ActorEligible } from "../lib/guidance.ts";
import { isWorkspaceAdminInviteRole } from "../lib/workspace-invitation-roles.ts";

assert.equal(isWorkspaceAdminInviteRole("member"), true, "Workspace Admin can invite a Member.");
assert.equal(isWorkspaceAdminInviteRole("viewer"), true, "Workspace Admin can invite a Viewer.");
assert.equal(isWorkspaceAdminInviteRole("admin"), false, "Workspace Admin cannot invite another Admin.");
assert.equal(isGettingStartedV1ActorEligible({ workspaceRole: "admin", isPlatformOwner: false }), true, "An ordinary Workspace Admin can view the first-admin program.");
assert.equal(isGettingStartedV1ActorEligible({ workspaceRole: "member", isPlatformOwner: false }), false, "Members cannot view Admin Guidance.");
assert.equal(isGettingStartedV1ActorEligible({ workspaceRole: "viewer", isPlatformOwner: false }), false, "Viewers cannot view Admin Guidance.");
assert.equal(isGettingStartedV1ActorEligible({ workspaceRole: "admin", isPlatformOwner: true }), false, "Platform Owners do not receive the workspace bootstrap program.");

const [invitationRoute, guidanceRoute, page, platformInviteRoute, ownerView, styles] = await Promise.all([
  readFile(new URL("../app/api/admin/invitations/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/guidance/status/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/platform/workspaces/invite-admin/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/platform-administration-view.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8")
]);

assert.equal((invitationRoute.match(/isWorkspaceAdminInviteRole\(role\)/g) ?? []).length, 2, "POST and role-change invitation actions enforce collaborator-only roles.");
assert.match(invitationRoute, /Workspace Admins can invite Members or Viewers only/);
assert.match(platformInviteRoute, /requirePlatformOwner/);
assert.match(platformInviteRoute, /create_provisional_workspace_admin_invitation/);
assert.doesNotMatch(page.slice(page.indexOf("<h2>Invite Member</h2>"), page.indexOf("<h2>Invitations</h2>")), /option value="admin"/);
assert.match(page, /invitation\.role === "admin" \? <span className="workspace-invitation-role-readonly">Admin<\/span>/);
assert.match(guidanceRoute, /canViewGettingStartedGuidance/);
assert.match(guidanceRoute, /workspaceRole !== "admin"/);
assert.match(guidanceRoute, /app_platform_operators/);
assert.doesNotMatch(ownerView, /Toggle onboarding guidance defaults/);
assert.doesNotMatch(ownerView, /isGuidanceOpen/);
assert.match(styles, /\.platform-admin-canvas \{[\s\S]*max-width: 1360px;/, "Platform Administration starts at the stable wide desktop width.");

console.log("Pre-beta role and Guidance hardening checks passed.");

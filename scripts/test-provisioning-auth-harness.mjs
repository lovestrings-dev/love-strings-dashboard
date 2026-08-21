import assert from "node:assert/strict";
import { postAuthDecision, shouldUseExistingSession } from "../lib/provisioning-auth-flow.ts";

const inviteCallback = { kind: "code", code: "synthetic", type: "invite" };
const magicLinkCallback = { kind: "code", code: "synthetic", type: "magiclink" };
const recoveryCallback = { kind: "otp", tokenHash: "synthetic", type: "recovery" };

function decision(input) {
  return postAuthDecision({ callback: null, continuation: "none", hasProvisioningHint: false, ordinaryInvitation: false, workspaceJoin: false, ...input });
}

// New recipient: password then provisioning, with no generic redirect.
assert.deepEqual(decision({ callback: inviteCallback, continuation: "one" }), { kind: "provisioning", needsPassword: true });
// Existing recipient: magic link does not require a new password.
assert.deepEqual(decision({ callback: magicLinkCallback, continuation: "one" }), { kind: "provisioning", needsPassword: false });
// User A's stored session never changes the callback-derived outcome for User B.
assert.equal(shouldUseExistingSession({ callback: magicLinkCallback, hasProvisioningHint: true }), false);
assert.deepEqual(decision({ callback: magicLinkCallback, continuation: "one" }), { kind: "provisioning", needsPassword: false });
// A consumed callback cannot fall back to User A.
assert.deepEqual(decision({ callback: magicLinkCallback, continuation: "none", hasProvisioningHint: true }), { kind: "error", message: "No active provisioning invitation was found for this account." });
// A normal existing session without callback/hint is still a normal, non-provisioning route.
assert.equal(shouldUseExistingSession({ callback: null, hasProvisioningHint: false }), true);
assert.deepEqual(decision({}), { kind: "redirect-home" });
// Provisioning still resolves from server state when the custom query was lost.
assert.deepEqual(decision({ callback: magicLinkCallback, continuation: "one", hasProvisioningHint: false }), { kind: "provisioning", needsPassword: false });
// Expired, revoked, or replayed invitations are all continuation-none and cannot create a workspace.
for (const status of ["expired", "revoked", "accepted/replayed"]) {
  assert.equal(decision({ callback: magicLinkCallback, continuation: "none", hasProvisioningHint: true }).kind, "error", status);
}
// Exactly-one match is enforced; ambiguity cannot guess an invitation.
assert.equal(decision({ callback: magicLinkCallback, continuation: "ambiguous" }).kind, "error");
// Ordinary workspace invitations remain separate.
assert.deepEqual(decision({ ordinaryInvitation: true }), { kind: "generic-password" });
assert.deepEqual(decision({ ordinaryInvitation: true, workspaceJoin: true }), { kind: "redirect-workspace" });
// Generic recovery remains a password flow, not provisioning.
assert.deepEqual(decision({ callback: recoveryCallback }), { kind: "generic-password" });

console.log("Provisioning Auth-boundary harness passed: 11 deterministic scenarios.");

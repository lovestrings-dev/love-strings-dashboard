import assert from "node:assert/strict";
import {
  defaultOAuthReturnPath,
  getSafeOAuthReturnPath,
  hashOAuthState,
  validateOAuthAttemptRecord
} from "../lib/oauth-attempt.ts";

const origin = "https://dashboard.example.test";
const now = new Date("2026-08-14T10:00:00.000Z");
const baseAttempt = {
  consumed_at: null,
  expires_at: "2026-08-14T10:10:00.000Z",
  integration_kind: "meta:creator-social",
  return_path: "/?settings=general",
  user_id: "user-a",
  workspace_id: "workspace-a"
};
const valid = (attempt = baseAttempt, overrides = {}) =>
  validateOAuthAttemptRecord(attempt, {
    authenticatedUserId: "user-a",
    expectedIntegrationKind: "meta:creator-social",
    now,
    workspaceAuthorized: true,
    ...overrides
  });

assert.equal(valid(), null, "valid attempt succeeds");
const attemptsByStateHash = new Map([[hashOAuthState("correct-state"), baseAttempt]]);
assert.equal(attemptsByStateHash.get(hashOAuthState("correct-state")), baseAttempt);
assert.equal(attemptsByStateHash.get(hashOAuthState("wrong-state")), undefined, "wrong state fails lookup");
assert.equal(valid({ ...baseAttempt, expires_at: "2026-08-14T10:00:00.000Z" }), "expired");
assert.equal(valid({ ...baseAttempt, consumed_at: now.toISOString() }), "consumed");
assert.equal(valid(baseAttempt, { expectedIntegrationKind: "meta:fstats-login" }), "integration-kind");
assert.equal(valid(baseAttempt, { authenticatedUserId: "user-b" }), "user");
assert.equal(valid(baseAttempt, { workspaceAuthorized: false }), "workspace-authorization");

const switchedWorkspaceAttempt = { ...baseAttempt, workspace_id: "workspace-a" };
assert.equal(valid(switchedWorkspaceAttempt), null, "stored workspace remains authoritative after active-workspace switch");

const secondTabAttempt = { ...baseAttempt, integration_kind: "meta:fstats-login", workspace_id: "workspace-b" };
assert.equal(valid(secondTabAttempt, { expectedIntegrationKind: "meta:fstats-login" }), null, "different-tab attempt coexists");
assert.notEqual(baseAttempt.workspace_id, secondTabAttempt.workspace_id, "different workspace attempts coexist");

assert.equal(getSafeOAuthReturnPath("/platforms?view=all", origin), "/platforms?view=all");
assert.equal(getSafeOAuthReturnPath(`${origin}/?settings=general`, origin), "/?settings=general");
assert.equal(getSafeOAuthReturnPath("https://evil.example/steal", origin), defaultOAuthReturnPath);
assert.equal(getSafeOAuthReturnPath("//evil.example/steal", origin), defaultOAuthReturnPath);

console.log("OAuth attempt helper tests passed.");

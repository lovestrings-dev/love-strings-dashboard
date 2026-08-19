import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
process.env.APP_CANONICAL_ORIGIN = "https://love-strings-dashboard.vercel.app";
import {
  createOAuthResultReturnUrl,
  defaultOAuthReturnPath,
  getAllowedOAuthReturnOrigin,
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
assert.equal(getSafeOAuthReturnPath("/%2f%2fevil.example/steal", origin), defaultOAuthReturnPath);
assert.equal(getSafeOAuthReturnPath("javascript:alert(1)", origin), defaultOAuthReturnPath);

assert.equal(getAllowedOAuthReturnOrigin("http://localhost:3000"), "http://localhost:3000");
assert.equal(getAllowedOAuthReturnOrigin("https://love-strings-dashboard.vercel.app"), "https://love-strings-dashboard.vercel.app");
assert.throws(() => getAllowedOAuthReturnOrigin("https://evil.example"));
assert.throws(() => getAllowedOAuthReturnOrigin("https://evil.love-strings-dashboard.vercel.app"));
assert.throws(() => getAllowedOAuthReturnOrigin("http://localhost:3001"));
assert.throws(() => getAllowedOAuthReturnOrigin("not a url"));
assert.throws(() => getAllowedOAuthReturnOrigin("https://user:pass@love-strings-dashboard.vercel.app"));
assert.throws(() => getAllowedOAuthReturnOrigin("https://love-strings-dashboard.vercel.app/callback"));
assert.throws(() => getAllowedOAuthReturnOrigin("https://love-strings-dashboard.vercel.app/?next=x"));

const resultUrl = createOAuthResultReturnUrl({
  origin: "http://localhost:3000",
  returnPath: "/?settings=general",
  result: "creator-social-instagram-connected"
});
assert.equal(resultUrl.toString(), "http://localhost:3000/?settings=general&oauth=creator-social-instagram-connected");
assert.throws(() => createOAuthResultReturnUrl({ origin: "https://evil.example", returnPath: "/", result: "ok" }));
assert.throws(() => createOAuthResultReturnUrl({ origin: "http://localhost:3000", returnPath: "//evil.example", result: "ok" }));
assert.throws(() => createOAuthResultReturnUrl({ origin: "http://localhost:3000", returnPath: "/", result: "token=secret" }));

const migration = await readFile(new URL("../supabase/migrations/202608190001_add_fixed_callback_oauth_attempts.sql", import.meta.url), "utf8");
assert.match(migration, /return_origin in \([\s\S]*http:\/\/localhost:3000[\s\S]*https:\/\/love-strings-dashboard\.vercel\.app/);
assert.match(migration, /attempt\.integration_kind <> p_integration_kind/);
assert.match(migration, /attempt\.consumed_at is not null/);
assert.match(migration, /attempt\.expires_at <= now\(\)/);
assert.match(migration, /membership\.workspace_id = attempt\.workspace_id/);
assert.match(migration, /membership\.user_id = attempt\.user_id/);
const serverSource = await readFile(new URL("../lib/server/oauth-attempts.ts", import.meta.url), "utf8");
assert.match(serverSource, /createFixedCallbackOAuthAttempt/);
assert.match(serverSource, /returnOrigin = getAllowedOAuthReturnOrigin\(origin\)/);
assert.match(serverSource, /requiredWorkspaceRole = "admin"/);
assert.match(serverSource, /consumeFixedCallbackOAuthAttempt/);
assert.match(serverSource, /consume_app_oauth_attempt_for_fixed_callback/);

console.log("OAuth attempt helper tests passed.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { deriveFstatsLoginUiModel } = await import("../lib/meta/fstats-login-ui.ts");
const component = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/integrations/meta/fstats-login/selection/route.ts", import.meta.url), "utf8");
const connections = await readFile(new URL("../lib/server/meta-connections.ts", import.meta.url), "utf8");
const discovery = await readFile(new URL("../lib/server/meta-fstats-discovery.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/202608180001_meta_local_disconnect_actions.sql", import.meta.url), "utf8");

const connection = { connectionId: "connection-1", kind: "fstats_login_facebook_page", authorization: "valid", updatedAt: "2026-08-18T00:00:00Z", tokenExpiresAt: null };
const page = { externalId: "1024037014125778", displayName: "Love Strings Band" };
const instagram = { externalId: "17841480743173848", displayName: "@lovestringsband", parentPageExternalId: page.externalId };
const base = { connection, pageCandidates: [] };
const states = [
  { stage: "not_authorized", userAction: { kind: "authorize" } },
  { ...base, stage: "page_selection_required", userAction: { kind: "select_page" } },
  { ...base, stage: "page_selected_instagram_discovery", page, instagram: { status: "discovery_pending", startedAt: "2026-08-18T00:00:00Z" }, userAction: null },
  { ...base, stage: "instagram_decision_required", page, instagram: { status: "available", candidate: instagram, discoveredAt: "2026-08-18T00:00:00Z" }, userAction: { kind: "choose_instagram" } },
  { ...base, stage: "connected", page, instagram: { status: "skipped", candidate: instagram, skippedAt: "2026-08-18T00:00:00Z" }, userAction: null },
  { ...base, stage: "connected", page, instagram: { status: "connected", account: instagram }, userAction: null },
  { ...base, stage: "needs_attention", page, attention: { code: "INSTAGRAM_DISCOVERY_FAILED", category: "provider", message: "Retry Instagram discovery.", retryable: true, pageBindingPreserved: true, instagramBindingPreserved: false }, userAction: { kind: "retry_instagram_discovery" } },
];

for (const state of states) assert.equal(deriveFstatsLoginUiModel(state).panel, state.stage, `${state.stage} maps to exactly its own UI panel`);
assert.equal(deriveFstatsLoginUiModel(states[0]).summary, "Meta access not connected · Facebook Page not connected");
assert.match(deriveFstatsLoginUiModel(states[2]).summary, /Facebook: Love Strings Band · Instagram: checking/);
assert.match(deriveFstatsLoginUiModel(states[3]).summary, /Instagram: @lovestringsband not connected/);
assert.match(deriveFstatsLoginUiModel(states[5]).summary, /@lovestringsband/);
assert.doesNotMatch(deriveFstatsLoginUiModel(states[5]).summary, /1024037014125778|17841480743173848/, "stable IDs are not primary UI identity");

for (const stage of ["not_authorized", "page_selection_required", "page_selected_instagram_discovery", "instagram_decision_required", "connected", "needs_attention"]) {
  assert.match(component, new RegExp(`data\\?\\.stage === \\"${stage}\\"`), `${stage} has an explicit exclusive render branch`);
}
assert.match(component, /Checking Meta connection…/, "initial loading never flashes a disconnected state");
assert.match(component, /Reconnect Facebook access/, "authorization action is distinct from workspace Page binding");
assert.match(component, /Meta authorization is still active[\s\S]*Choose a Facebook Page for this workspace/, "local Page disconnect does not imply provider reauthorization");
assert.match(component, /Connect this Page/, "Page candidate action clearly means workspace binding");
assert.doesNotMatch(component, /Use this Page/, "ambiguous Page-selection wording was removed");
assert.match(component, /Manage Facebook access/, "provider access management is available as a secondary path");
assert.match(component, /Refresh available Pages/, "Page candidates can be refreshed without auth_type=rerequest");
assert.match(component, /Need a different Page\?/, "access-management and candidate-refresh actions share explanatory context");
assert.match(component, /Instagram[\s\S]*displayName[\s\S]*Not connected[\s\S]*Connect Instagram/, "skipped Instagram remains visible and reconnectable");
assert.match(component, /Skip means not now/, "Instagram Skip is presented as a durable optional decision");
assert.match(component, /Disconnect Instagram/, "Instagram-only disconnect is exposed");
assert.match(component, /Disconnect Facebook Page/, "Page-local disconnect is exposed");
assert.match(component, /hasMetaContinuation[\s\S]*!data[\s\S]*!isOpen[\s\S]*requestState === "loading"[\s\S]*requestAnimationFrame[\s\S]*focus[\s\S]*scrollIntoView/, "OAuth return waits for mounted authoritative state and expanded Meta UI before focus and scroll");
assert.match(component, /metaContinuationConsumed\.current = true[\s\S]*history\.replaceState[\s\S]*setHasMetaContinuation\(false\)/, "OAuth continuation is consumed once and cleared in memory without a reload");
assert.match(component, /cleanConsumedFstatsLoginContinuation/, "OAuth return cleanup uses the scoped URL helper");
assert.doesNotMatch(component, /auth_type|deauthoriz/i, "UI introduces no speculative provider revocation parameters");
assert.match(route, /disconnect_instagram/);
assert.match(route, /disconnect_page/);
assert.match(route, /refresh_pages/);
assert.match(route, /preserveValidBindingOnFailure/, "connected Page refresh failures remain secondary warnings");
assert.doesNotMatch(connections, /platform_accounts\(meta_external_id\)/, "Page refresh does not use an ambiguous relationship embed");
assert.match(connections, /select\("meta_external_id"\)/, "selected Page identity is read through its explicit account ID");
assert.match(discovery, /!input\.preserveValidBindingOnFailure \|\| authorizationInvalid/, "only authorization failures may degrade a valid binding");
assert.match(migration, /connection_state = 'awaiting_selection'/, "Page disconnect preserves authorization and returns to selection state");
assert.match(migration, /asset_state = 'missing'/, "Page disconnect preserves Instagram history as non-actionable");
assert.match(migration, /revoke all[\s\S]*grant execute[\s\S]*service_role/, "disconnect RPCs remain service-role-only");

console.log("Meta onboarding UI/state tests passed.");

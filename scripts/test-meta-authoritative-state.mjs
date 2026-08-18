import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const stateSource = (await readFile(new URL("../lib/meta/fstats-login-state.ts", import.meta.url), "utf8"))
  .replace('import { missingMetaScopes } from "./scopes";', `const missingMetaScopes = (_kind, grantedScopes) => ["business_management", "pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights"].filter((scope) => !new Set(grantedScopes).has(scope));`);
const stateJavaScript = stripTypeScriptTypes(stateSource, { mode: "strip" });
const { databaseFailureState, deriveFstatsLoginState } = await import(`data:text/javascript;base64,${Buffer.from(stateJavaScript).toString("base64")}`);
const { discoverFstatsLoginLinkedInstagram, MetaGraphRequestError } = await import("../lib/meta/fstats-login-oauth.ts");
const { MetaPageSelectionError, metaSelectionErrorHttpStatus } = await import("../lib/meta/selection-error.ts");

const now = "2026-08-17T12:00:00.000Z";
const connection = {
  id: "connection-1", connection_kind: "fstats_login_facebook_page", connection_state: "connected",
  granted_scopes: ["business_management", "pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights"],
  token_expires_at: "2026-09-17T12:00:00.000Z", last_error_code: null, last_error_summary: null, updated_at: now,
};
const pageCandidate = { id: "candidate-page", account_type: "facebook_page", external_id: "page-1", display_name: "Love Strings", parent_external_id: null, asset_state: "available", discovered_at: now, updated_at: now };
const pageMapping = { id: "mapping-page", account_type: "facebook_page", platform_account_id: "account-page", parent_platform_account_id: null, is_selected: true, asset_state: "selected", last_successful_sync_at: now, last_error_code: null, last_error_summary: null, updated_at: now };
const pageAccount = { id: "account-page", meta_external_id: "page-1", account_name: "Love Strings" };
const pageBinding = { external_id: "page-1", workspace_id: "workspace-1", connection_id: "connection-1", mapping_id: "mapping-page" };
const base = (overrides = {}) => ({ now, workspaceId: "workspace-1", connections: [connection], candidates: [pageCandidate], mappings: [pageMapping], accounts: [pageAccount], pageBindings: [pageBinding], instagramBindings: [], ...overrides });

assert.equal(deriveFstatsLoginState(base({ connections: [], candidates: [], mappings: [], accounts: [], pageBindings: [] })).stage, "not_authorized");
assert.equal(deriveFstatsLoginState(base({ connections: [connection, { ...connection, id: "connection-2" }] })).attention.code, "AMBIGUOUS_CONNECTION", "multiple connections fail closed instead of selecting latest");
assert.equal(deriveFstatsLoginState(base({ mappings: [], accounts: [], pageBindings: [] })).stage, "page_selection_required");
const boundElsewhere = deriveFstatsLoginState(base({ mappings: [], accounts: [], pageBindings: [{ ...pageBinding, workspace_id: "private-other-workspace" }] }));
assert.equal(boundElsewhere.pageCandidates[0].selectable, false);
assert.equal(boundElsewhere.pageCandidates[0].availability, "bound_elsewhere");
assert.doesNotMatch(JSON.stringify(boundElsewhere), /private-other-workspace/, "other-workspace IDs never leave the state contract");
assert.equal(databaseFailureState().attention.code, "DATABASE_QUERY_FAILED", "database failures are explicit, never absence");
assert.equal(metaSelectionErrorHttpStatus(new MetaPageSelectionError("P2001", "conflict")), 409, "a cross-workspace Page conflict is an explicit conflict response");
assert.equal(deriveFstatsLoginState(base({ mappings: [pageMapping, { ...pageMapping, id: "mapping-page-duplicate", platform_account_id: "account-page-duplicate" }] })).attention.code, "DUPLICATE_SELECTED_PAGE");

const pending = deriveFstatsLoginState(base({ mappings: [{ ...pageMapping, last_successful_sync_at: null, updated_at: "2026-08-17T11:59:30.000Z" }] }));
assert.equal(pending.stage, "page_selected_instagram_discovery");
const stalled = deriveFstatsLoginState(base({ mappings: [{ ...pageMapping, last_successful_sync_at: null, updated_at: "2026-08-17T11:55:00.000Z" }] }));
assert.equal(stalled.attention.code, "INSTAGRAM_DISCOVERY_STALLED");
assert.equal(stalled.attention.pageBindingPreserved, true);

const instagramCandidate = { id: "candidate-instagram", account_type: "instagram_professional", external_id: "ig-1", display_name: "@lovestrings", parent_external_id: "page-1", asset_state: "available", discovered_at: now, updated_at: now };
const decision = deriveFstatsLoginState(base({ candidates: [pageCandidate, instagramCandidate] }));
assert.equal(decision.stage, "instagram_decision_required");
assert.equal(decision.instagram.candidate.parentPageExternalId, "page-1");
assert.equal(deriveFstatsLoginState(base({ candidates: [pageCandidate, instagramCandidate, { ...instagramCandidate, id: "candidate-instagram-2", external_id: "ig-2" }] })).attention.code, "DUPLICATE_INSTAGRAM_CANDIDATE");
const skipped = deriveFstatsLoginState(base({ candidates: [pageCandidate, { ...instagramCandidate, asset_state: "skipped" }] }));
assert.equal(skipped.stage, "connected");
assert.equal(skipped.instagram.status, "skipped", "Skip is durable state, not frontend-only state");
const noInstagram = deriveFstatsLoginState(base());
assert.equal(noInstagram.stage, "connected");
assert.equal(noInstagram.instagram.status, "not_linked", "successful discovery with no candidate is explicit and terminal");

const instagramMapping = { id: "mapping-instagram", account_type: "instagram_professional", platform_account_id: "account-instagram", parent_platform_account_id: "account-page", is_selected: true, asset_state: "selected", last_successful_sync_at: now, last_error_code: null, last_error_summary: null, updated_at: now };
const connected = deriveFstatsLoginState(base({
  candidates: [pageCandidate, instagramCandidate], mappings: [pageMapping, instagramMapping],
  accounts: [pageAccount, { id: "account-instagram", meta_external_id: "ig-1", account_name: "@lovestrings" }],
  instagramBindings: [{ external_id: "ig-1", workspace_id: "workspace-1", connection_id: "connection-1", mapping_id: "mapping-instagram", parent_page_external_id: "page-1" }],
}));
assert.equal(connected.stage, "connected");
assert.equal(connected.instagram.status, "connected");
const connectedAfterSkip = deriveFstatsLoginState(base({
  candidates: [pageCandidate, { ...instagramCandidate, asset_state: "skipped" }], mappings: [pageMapping, instagramMapping],
  accounts: [pageAccount, { id: "account-instagram", meta_external_id: "ig-1", account_name: "@lovestrings" }],
  instagramBindings: [{ external_id: "ig-1", workspace_id: "workspace-1", connection_id: "connection-1", mapping_id: "mapping-instagram", parent_page_external_id: "page-1" }],
}));
assert.equal(connectedAfterSkip.instagram.status, "connected", "explicit Connect remains valid after durable Skip");
const differentInstagram = deriveFstatsLoginState(base({ candidates: [pageCandidate, { ...instagramCandidate, external_id: "ig-new", asset_state: "available" }] }));
assert.equal(differentInstagram.stage, "instagram_decision_required", "a different Instagram ID reopens the decision");

const switched = deriveFstatsLoginState(base({
  candidates: [{ ...pageCandidate, external_id: "page-2", display_name: "New Page" }],
  mappings: [{ ...pageMapping, platform_account_id: "account-page-2", last_successful_sync_at: null, updated_at: "2026-08-17T11:59:50.000Z" }],
  accounts: [{ id: "account-page-2", meta_external_id: "page-2", account_name: "New Page" }],
  pageBindings: [{ external_id: "page-2", workspace_id: "workspace-1", connection_id: "connection-1", mapping_id: "mapping-page" }],
}));
assert.equal(switched.stage, "page_selected_instagram_discovery");
assert.equal(switched.page.externalId, "page-2", "a Page switch derives only from the new authoritative Page");

const expired = deriveFstatsLoginState(base({ connections: [{ ...connection, token_expires_at: "2026-08-16T12:00:00.000Z" }] }));
assert.equal(expired.attention.code, "TOKEN_EXPIRED");
assert.equal(expired.userAction.kind, "reauthorize");
const failedDiscovery = deriveFstatsLoginState(base({ mappings: [{ ...pageMapping, last_successful_sync_at: null, last_error_code: "meta_graph_rate_limit", last_error_summary: "safe" }] }));
assert.equal(failedDiscovery.attention.code, "INSTAGRAM_DISCOVERY_FAILED");
assert.equal(failedDiscovery.attention.pageBindingPreserved, true);

const loveStringsFixture = deriveFstatsLoginState(base({
  candidates: [
    { ...pageCandidate, external_id: "1024037014125778", display_name: "Love Strings Band" },
    { ...instagramCandidate, external_id: "17841480743173848", display_name: "@lovestringsband", parent_external_id: "1024037014125778" },
  ],
  mappings: [{ ...pageMapping, platform_account_id: "account-love-strings" }],
  accounts: [{ id: "account-love-strings", meta_external_id: "1024037014125778", account_name: "Love Strings Band" }],
  pageBindings: [{ external_id: "1024037014125778", workspace_id: "workspace-1", connection_id: "connection-1", mapping_id: "mapping-page" }],
}));
assert.equal(loveStringsFixture.stage, "instagram_decision_required");
assert.equal(loveStringsFixture.instagram.candidate.externalId, "17841480743173848");

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 190, message: "raw provider text must not escape" } }), { status: 401 });
await assert.rejects(() => discoverFstatsLoginLinkedInstagram("test-token", "page-1"), (error) => error instanceof MetaGraphRequestError && error.kind === "token" && error.message === "Meta Graph request failed.");
globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 4 } }), { status: 429 });
await assert.rejects(() => discoverFstatsLoginLinkedInstagram("test-token", "page-1"), (error) => error instanceof MetaGraphRequestError && error.kind === "rate_limit" && error.retryable);
globalThis.fetch = originalFetch;

const migration = await readFile(new URL("../supabase/migrations/202608170004_meta_authoritative_state_and_rebinding.sql", import.meta.url), "utf8");
assert.match(migration, /v_old_external_id is distinct from p_external_id[\s\S]*?delete from public\.app_meta_active_instagram_bindings/, "Page switching clears stale Instagram bindings transactionally");
assert.match(migration, /asset_state = 'skipped'/, "Skip is persisted in the database");
assert.match(migration, /last_successful_sync_at = now\(\)/, "successful no-Instagram discovery has a durable checked marker");
assert.match(migration, /asset_state in \('available', 'skipped'\)/, "a skipped same-pair candidate can later be connected");

console.log("Meta authoritative state behavioral tests passed.");

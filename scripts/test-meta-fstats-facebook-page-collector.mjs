import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64url");
const { decryptMetaTokenPayload, encryptMetaTokenPayload } = await import("../lib/meta/tokens.ts");
globalThis.__facebookCollectorDeps = { decryptMetaTokenPayload, defaultWorkspaceTimeZone: "Europe/Vienna", resolveTimeZone: (value) => value ?? null };
let source = await readFile(new URL("../lib/metrics/meta-fstats-facebook-page-collector.ts", import.meta.url), "utf8");
source = source.replace(/import type[^\n]+\n/, "").replace(/import \{ decryptMetaTokenPayload \}[^\n]+\n/, "const { decryptMetaTokenPayload } = globalThis.__facebookCollectorDeps;\n").replace(/import \{ defaultWorkspaceTimeZone, resolveTimeZone \}[^\n]+\n/, "const { defaultWorkspaceTimeZone, resolveTimeZone } = globalThis.__facebookCollectorDeps;\n");
const collectorModule = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "strip" })).toString("base64")}`);
const { MetaFstatsFacebookPageCollectorError, refreshMetaFstatsFacebookPageMetrics } = collectorModule;

const workspace = "workspace-1", connection = "connection-1", page = "page-account", pageId = "1024037014125778";
function fixture(overrides = {}) {
  const state = { snapshots: new Map(), writes: 0, ...overrides };
  const rows = {
    connections: [{ id: connection, encrypted_token_payload: encryptMetaTokenPayload({ accessToken: "user-token" }), connection_state: "connected" }],
    mappings: [{ id: "page-mapping", account_type: "facebook_page", platform_account_id: page, is_selected: true, asset_state: "selected" }],
    accounts: [{ id: page, workspace_id: workspace, platform_id: "facebook-platform", meta_external_id: pageId, external_id: pageId }],
    setting: { timezone: "Europe/Vienna" },
    ...overrides.rows,
  };
  const resultFor = (table) => {
    if (table === "app_meta_connections") return { data: rows.connections, error: null };
    if (table === "app_meta_connection_accounts") return { data: rows.mappings, error: null };
    if (table === "platform_accounts") return { data: rows.accounts, error: null };
    if (table === "platforms") return { data: { slug: "facebook" }, error: null };
    if (table === "app_workspace_settings") return { data: rows.setting, error: null };
    if (table === "platform_metric_snapshots") return { data: null, error: state.persistenceError ?? null };
    return { data: null, error: null };
  };
  const client = { from(table) {
    const builder = {
      select() { return builder; }, eq() { return builder; }, limit() { return builder; }, maybeSingle() { return Promise.resolve(resultFor(table)); },
      upsert(values) { if (table === "platform_metric_snapshots") { state.writes += 1; for (const value of values) state.snapshots.set([value.snapshot_date, value.metric_name, value.source].join("|"), value); } return builder; },
      then(resolve, reject) { return Promise.resolve(resultFor(table)).then(resolve, reject); },
    };
    return builder;
  } };
  return { client, state, rows };
}
function graph(responses) { let index = 0; return async () => { const next = responses[index++]; if (next instanceof Response) return next; return new Response(JSON.stringify(next), { status: 200 }); }; }
const graphSuccess = () => graph([
  { data: [{ id: pageId, access_token: "page-token" }] },
  { id: pageId, followers_count: 61 },
  { data: [{ name: "page_post_engagements", values: [{ value: 4, end_time: "2026-08-17T07:00:00+0000" }, { value: 7, end_time: "2026-08-18T07:00:00+0000" }, { value: 0, end_time: "2026-08-19T07:00:00+0000" }] }] },
  { data: [{ name: "page_actions_post_reactions_total", values: [{ value: { like: 2, love: 1 }, end_time: "2026-08-18T07:00:00+0000" }] }] },
]);

const now = new Date("2026-08-18T15:00:00Z");
const ok = fixture();
const result = await refreshMetaFstatsFacebookPageMetrics(workspace, ok.client, graphSuccess(), now);
assert.equal(result.accountId, page); assert.deepEqual(result.metrics, { followers: 61, postEngagementsDaily: 7, postReactionsDaily: 3 });
assert.equal(ok.state.snapshots.size, 3); assert.equal(ok.state.writes, 1, "all required metrics persist in one upsert statement");
assert.equal([...ok.state.snapshots.values()].every((row) => row.platform_account_id === page && row.source === "meta-fstats-facebook-page-api"), true);
assert.equal(ok.state.snapshots.get("2026-08-18|followers|meta-fstats-facebook-page-api").imported_at, now.toISOString());
await refreshMetaFstatsFacebookPageMetrics(workspace, ok.client, graphSuccess(), new Date("2026-08-18T16:00:00Z"));
assert.equal(ok.state.snapshots.size, 3, "same-day collection upserts instead of duplicating");
assert.equal(ok.state.snapshots.get("2026-08-18|followers|meta-fstats-facebook-page-api").imported_at, "2026-08-18T16:00:00.000Z");

for (const scenario of [
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture({ rows: { connections: [] } }).client, graphSuccess(), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture({ rows: { connections: [{ id: connection, encrypted_token_payload: encryptMetaTokenPayload({ accessToken: "one" }), connection_state: "connected" }, { id: "connection-2", encrypted_token_payload: encryptMetaTokenPayload({ accessToken: "two" }), connection_state: "connected" }] } }).client, graphSuccess(), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture({ rows: { connections: [{ id: connection, encrypted_token_payload: "invalid", connection_state: "connected" }] } }).client, graphSuccess(), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture({ rows: { mappings: [] } }).client, graphSuccess(), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture().client, graph([{ data: [] }]), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture().client, graph([new Response("{}", { status: 403 })]), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture().client, graph([{ data: [{ id: pageId, access_token: "page-token" }] }, { id: pageId, followers_count: "bad" }, { data: [] }, { data: [] }]), now),
  () => refreshMetaFstatsFacebookPageMetrics(workspace, fixture().client, graph([{ data: [{ id: pageId, access_token: "page-token" }] }, { id: pageId, followers_count: 61 }, { data: [{ name: "page_post_engagements", values: [{ value: 1, end_time: "2026-08-18T07:00:00+0000" }] }] }, { data: [{ name: "page_actions_post_reactions_total", values: [{ value: { like: "bad" }, end_time: "2026-08-18T07:00:00+0000" }] }] }]), now),
]) await assert.rejects(scenario, MetaFstatsFacebookPageCollectorError);
await assert.rejects(() => refreshMetaFstatsFacebookPageMetrics(workspace, fixture({ persistenceError: { message: "database unavailable" } }).client, graphSuccess(), now), MetaFstatsFacebookPageCollectorError);
const noPartial = fixture();
await assert.rejects(() => refreshMetaFstatsFacebookPageMetrics(workspace, noPartial.client, graph([{ data: [{ id: pageId, access_token: "page-token" }] }, { id: pageId, followers_count: 61 }, { data: [] }, { data: [] }]), now), MetaFstatsFacebookPageCollectorError);
assert.equal(noPartial.state.writes, 0, "a required metric failure performs no persistence");

console.log("Meta App B Facebook Page collector tests passed.");

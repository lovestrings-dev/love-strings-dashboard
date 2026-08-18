import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");
const { decryptMetaTokenPayload, encryptMetaTokenPayload } = await import("../lib/meta/tokens.ts");
globalThis.__collectorDeps = {
  decryptMetaTokenPayload,
  defaultWorkspaceTimeZone: "Europe/Vienna",
  getWorkspaceDateKey: () => "2026-08-18",
  resolveTimeZone: (value) => value ?? null,
};
let source = await readFile(new URL("../lib/metrics/meta-fstats-instagram-collector.ts", import.meta.url), "utf8");
source = source.replace(/import type[^\n]+\n/, "").replace(/import \{ decryptMetaTokenPayload \}[^\n]+\n/, "const { decryptMetaTokenPayload } = globalThis.__collectorDeps;\n").replace(/import \{ defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone \}[^\n]+\n/, "const { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } = globalThis.__collectorDeps;\n");
const collectorModule = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "strip" })).toString("base64")}`);
const { MetaFstatsInstagramCollectorError, refreshMetaFstatsInstagramMetrics } = collectorModule;

const workspace = "workspace-1", connection = "connection-1", page = "page-1", account = "account-history", mapping = "mapping-instagram", metaId = "17841480743173848";
function fixture(overrides = {}) {
  const state = { snapshots: new Map(), posts: new Map(), ...overrides };
  const rows = {
    connections: [{ id: connection, encrypted_token_payload: encryptMetaTokenPayload({ accessToken: "app-b-token" }), connection_state: "connected" }],
    mappings: [
      { id: "mapping-page", account_type: "facebook_page", platform_account_id: page, parent_platform_account_id: null, is_selected: true, asset_state: "selected" },
      { id: mapping, account_type: "instagram_professional", platform_account_id: account, parent_platform_account_id: page, is_selected: true, asset_state: "selected" },
    ],
    accounts: [
      { id: page, workspace_id: workspace, platform_id: "platform-facebook", meta_external_id: "1024037014125778", external_id: "1024037014125778", account_name: "Love Strings", url: null },
      { id: account, workspace_id: workspace, platform_id: "platform-instagram", meta_external_id: metaId, external_id: "36756415517336243", account_name: "Love Strings Instagram", url: "https://www.instagram.com/lovestringsband/" },
    ],
    bindings: [{ external_id: metaId, workspace_id: workspace, connection_id: connection, mapping_id: mapping, parent_page_external_id: "1024037014125778" }],
    ...overrides.rows,
  };
  const resultFor = (table, op) => {
    if (table === "app_meta_connections") return { data: rows.connections, error: null };
    if (table === "app_meta_connection_accounts") return { data: rows.mappings, error: null };
    if (table === "platform_accounts") return { data: rows.accounts, error: null };
    if (table === "platforms") return { data: { slug: "instagram" }, error: null };
    if (table === "app_meta_active_instagram_bindings") return { data: rows.bindings, error: null };
    if (table === "app_workspace_settings") return { data: { timezone: "Europe/Vienna" }, error: null };
    if (table === "content_posts" && op === "single") return { data: { id: "post-latest" }, error: null };
    return { data: null, error: null };
  };
  const client = { from(table) {
    let op = "await";
    const builder = {
      select() { return builder; }, eq() { return builder; }, in() { return builder; }, limit() { return builder; },
      maybeSingle() { op = "maybeSingle"; return Promise.resolve(resultFor(table, op)); },
      single() { op = "single"; return Promise.resolve(resultFor(table, op)); },
      upsert(value) {
        if (table === "platform_metric_snapshots") {
          const key = [value.snapshot_date, value.platform_account_id, value.content_post_id ?? "", value.metric_name, value.source].join("|"); state.snapshots.set(key, value);
        }
        if (table === "content_posts") state.posts.set(value.external_id, value);
        return builder;
      },
      then(resolve, reject) { return Promise.resolve(resultFor(table, op)).then(resolve, reject); },
    };
    return builder;
  } };
  return { client, state, rows };
}
function graph(responses) { let index = 0; return async (url) => { const next = responses[index++]; if (next instanceof Response) return next; return new Response(JSON.stringify(next), { status: 200 }); }; }
const graphSuccess = () => graph([
  { id: metaId, username: "lovestringsband", followers_count: 185 },
  { data: [{ id: "media-1", timestamp: "2026-08-18T10:00:00Z", media_product_type: "REELS", permalink: "https://instagram.test/media-1", caption: "Latest reel" }] },
  { data: [{ name: "reach", total_value: { value: 321 } }] },
  { data: [{ name: "views", total_value: { value: 654 } }] },
  { data: [{ name: "views", values: [{ value: 99 }] }] },
]);

const ok = fixture();
const result = await refreshMetaFstatsInstagramMetrics(workspace, ok.client, graphSuccess(), new Date("2026-08-18T10:00:00Z"));
assert.equal(result.accountId, account); assert.equal(result.metrics.followers, 185); assert.equal(result.metrics.latestMediaViews, 99);
assert.equal(ok.state.snapshots.size, 4); assert.equal([...ok.state.snapshots.values()].every((row) => row.platform_account_id === account), true);
assert.equal([...ok.state.snapshots.values()].every((row) => row.source === "instagram-api"), true);
assert.equal(ok.rows.accounts.find((row) => row.id === account).external_id, "36756415517336243", "legacy identity remains untouched");
await refreshMetaFstatsInstagramMetrics(workspace, ok.client, graphSuccess(), new Date("2026-08-18T11:00:00Z"));
assert.equal(ok.state.snapshots.size, 4, "same-day execution upserts rather than duplicates");
assert.equal([...ok.state.snapshots.values()].every((row) => row.imported_at === "2026-08-18T11:00:00.000Z"), true, "same-day execution advances the authoritative collection timestamp");

const noMedia = fixture();
await refreshMetaFstatsInstagramMetrics(workspace, noMedia.client, graph([
  { id: metaId, followers_count: 185 }, { data: [] },
  { data: [{ name: "reach", total_value: { value: 1 } }] }, { data: [{ name: "views", total_value: { value: 2 } }] },
]));
assert.equal(noMedia.state.snapshots.size, 3, "no recent media does not invent a latest-media metric");

for (const scenario of [
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture({ rows: { connections: [] } }).client, graphSuccess()),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture({ rows: { mappings: [] } }).client, graphSuccess()),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture({ rows: { accounts: [{ id: page, workspace_id: workspace, platform_id: "x", meta_external_id: "page", external_id: "page", account_name: "Page", url: null }, { id: account, workspace_id: workspace, platform_id: "platform-instagram", meta_external_id: null, external_id: "legacy", account_name: "IG", url: null }] } }).client, graphSuccess()),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture({ rows: { bindings: [] } }).client, graphSuccess()),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture({ rows: { connections: [{ id: connection, encrypted_token_payload: "invalid", connection_state: "connected" }] } }).client, graphSuccess()),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture().client, graph([new Response("{}", { status: 403 })])),
  () => refreshMetaFstatsInstagramMetrics(workspace, fixture().client, graph([{ id: metaId, followers_count: 1 }, { data: [] }, { data: [] }, { data: [{ name: "views", total_value: { value: 1 } }] }])),
]) await assert.rejects(scenario, MetaFstatsInstagramCollectorError);

console.log("Meta App B Instagram collector tests passed.");

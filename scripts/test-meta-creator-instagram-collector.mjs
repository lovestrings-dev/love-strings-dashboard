import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64url");
const { decryptMetaTokenPayload, encryptMetaTokenPayload } = await import("../lib/meta/tokens.ts");
globalThis.__collectorDeps = { decryptMetaTokenPayload, defaultWorkspaceTimeZone: "Europe/Vienna", getWorkspaceDateKey: () => "2026-08-19", resolveTimeZone: (value) => value ?? null };
let source = await readFile(new URL("../lib/metrics/meta-creator-instagram-collector.ts", import.meta.url), "utf8");
source = source.replace(/import type[^\n]+\n/, "").replace(/import \{ decryptMetaTokenPayload \}[^\n]+\n/, "const { decryptMetaTokenPayload } = globalThis.__collectorDeps;\n").replace(/import \{ defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone \}[^\n]+\n/, "const { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } = globalThis.__collectorDeps;\n");
const { MetaCreatorInstagramCollectorError, refreshMetaCreatorInstagramMetrics } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "strip" })).toString("base64")}`);
const workspace = "workspace-a", connection = "creator-connection", account = "creator-account", metaId = "17841400000000001";
function fixture(overrides = {}) {
  const state = { snapshots: new Map(), posts: new Map() };
  const rows = { connections: [{ id: connection, connection_state: "connected", encrypted_token_payload: encryptMetaTokenPayload({ accessToken: "app-a-token" }) }], mappings: [{ account_type: "instagram_professional", platform_account_id: account, is_selected: true, asset_state: "selected" }], accounts: [{ id: account, workspace_id: workspace, platform_id: "instagram-platform", meta_external_id: metaId, account_name: "Sounder Entertainment", url: "https://instagram.com/sounderentertainment" }], ...overrides };
  function result(table, op) { if (table === "app_meta_connections") return { data: rows.connections, error: null }; if (table === "app_meta_connection_accounts") return { data: rows.mappings, error: null }; if (table === "platform_accounts") return { data: rows.accounts, error: null }; if (table === "platforms") return { data: { slug: "instagram" }, error: null }; if (table === "app_workspace_settings") return { data: { timezone: "Europe/Vienna" }, error: null }; if (table === "content_posts" && op === "single") return { data: { id: "creator-post" }, error: null }; return { data: null, error: null }; }
  const client = { from(table) { let op = "await"; const builder = { select() { return builder; }, eq() { return builder; }, limit() { return builder; }, maybeSingle() { op = "maybeSingle"; return Promise.resolve(result(table, op)); }, single() { op = "single"; return Promise.resolve(result(table, op)); }, upsert(value) { const values = Array.isArray(value) ? value : [value]; if (table === "platform_metric_snapshots") for (const item of values) state.snapshots.set([item.metric_name, item.content_post_id ?? "", item.source].join("|"), item); if (table === "content_posts") state.posts.set(value.external_id, value); return builder; }, then(resolve, reject) { return Promise.resolve(result(table, op)).then(resolve, reject); } }; return builder; } };
  return { client, state };
}
function graph(responses) { let index = 0; return async () => new Response(JSON.stringify(responses[index++]), { status: 200 }); }
const ok = fixture();
const result = await refreshMetaCreatorInstagramMetrics(workspace, ok.client, graph([{ id: metaId, followers_count: 42 }, { data: [{ id: "media-1", media_product_type: "REELS", timestamp: "2026-08-19T11:00:00Z", caption: "A Reel" }] }, { data: [{ name: "reach", total_value: { value: 20 } }] }, { data: [{ name: "views", total_value: { value: 30 } }] }, { data: [{ name: "views", values: [{ value: 10 }] }] }]));
assert.equal(result.accountId, account); assert.equal(result.metrics.followers, 42); assert.equal(ok.state.snapshots.size, 4);
assert.ok([...ok.state.snapshots.values()].every((row) => row.source === "instagram-login-api" && row.platform_account_id === account));
await assert.rejects(() => refreshMetaCreatorInstagramMetrics(workspace, fixture({ connections: [] }).client, graph([])), MetaCreatorInstagramCollectorError);
await assert.rejects(() => refreshMetaCreatorInstagramMetrics(workspace, fixture({ mappings: [] }).client, graph([])), MetaCreatorInstagramCollectorError);
console.log("Meta App A standalone Instagram collector tests passed.");

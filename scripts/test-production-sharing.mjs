import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const sourceId = "11111111-1111-4111-8111-111111111111";
const destinationId = "22222222-2222-4222-8222-222222222222";
const songId = "33333333-3333-4333-8333-333333333333";
const shareId = "44444444-4444-4444-8444-444444444444";
const unrelatedId = "55555555-5555-4555-8555-555555555555";
let role = "admin", workspaceId = sourceId, denied = false;
const calls = [];
class WorkspaceAccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const rows = {
  app_workspace_members: [{ workspace_id: sourceId, user_id: "shared-member" }, { workspace_id: destinationId, user_id: "shared-member" }],
  app_workspaces: [{ id: sourceId, name: "Romeo", access_state: "active" }, { id: destinationId, name: "Dima", access_state: "active" }],
  production_song_sharing_defaults: [{ workspace_id: sourceId, destination_workspace_id: destinationId }],
  production_song_shares: [{ id: shareId, source_workspace_id: sourceId, production_song_id: songId, destination_workspace_id: destinationId }, { id: unrelatedId, source_workspace_id: sourceId, production_song_id: unrelatedId, destination_workspace_id: unrelatedId }],
  production_songs: [{ id: songId, title: "Linked song", production_steps: [] }, { id: unrelatedId, title: "Unrelated private song", production_steps: [] }]
};
const client = {
  from(table) {
    let data = [...(rows[table] ?? [])];
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { data = data.filter((row) => row[key] === value); return query; },
      neq(key, value) { data = data.filter((row) => row[key] !== value); return query; },
      in(key, values) { data = data.filter((row) => values.includes(row[key])); return query; },
      maybeSingle() { return Promise.resolve({ data: data[0] ?? null, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); }
    };
    return query;
  },
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === "production_share_destination_allowed") return { data: !denied, error: null };
    const allowed = name === "remove_received_production_song_share"
      ? args.p_share_id === shareId && args.p_workspace_id === destinationId
      : args.p_destination === null || args.p_destination === destinationId;
    return { error: allowed ? null : { message: "denied" } };
  }
};
globalThis.__sharingTest = {
  NextResponse: { json: (body, init) => Response.json(body, init) }, WorkspaceAccessError,
  requireWorkspaceAccess: async () => ({ serviceClient: client, workspaceId, role, user: { id: "authenticated-actor" } }),
  parseWorkspaceId: (value) => /^[0-9a-f-]{36}$/.test(value) ? value : null
};
let code = await readFile(new URL("../app/api/production/sharing/route.ts", import.meta.url), "utf8");
code = code.replace(/^import .*;\n/gm, "");
code = "const {NextResponse, WorkspaceAccessError, requireWorkspaceAccess, parseWorkspaceId} = globalThis.__sharingTest;\n" + code;
const { GET, PATCH } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString("base64")}`);
const request = (body, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/production/sharing", { method: "PATCH", headers: { origin, host: "localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });

assert.equal((await PATCH(request({ action: "share", songId, destinationId }, "https://untrusted.example"))).status, 401);
assert.equal(calls.length, 0, "cross-origin mutation never reaches database");
role = "member";
assert.equal((await PATCH(request({ action: "share", songId, destinationId }))).status, 200);
assert.equal((await PATCH(request({ action: "default", destinationId }))).status, 400);
assert.equal(calls.length, 1, "source members can share individual songs but cannot restore defaults");
role = "admin";
assert.equal((await PATCH(request({ action: "share", songId, destinationId, workspaceId: unrelatedId, actor: "spoofed" }))).status, 200);
assert.equal(calls.at(-1).args.p_workspace_id, sourceId);
assert.equal(calls.at(-1).args.p_actor, "authenticated-actor");
assert.equal((await PATCH(request({ action: "share", songId, destinationId: unrelatedId }))).status, 400);
assert.equal((await PATCH(request({ action: "share", songId, destinationId: "invalid" }))).status, 400);
assert.equal((await PATCH(request({ action: "default", destinationId }))).status, 400);
assert.equal((await PATCH(request({ action: "share", songId, destinationId: null }))).status, 200);
assert.equal(calls.at(-1).args.p_destination, null);
workspaceId = destinationId; role = "viewer";
assert.equal((await PATCH(request({ action: "remove-received", shareId }))).status, 200);
assert.equal((await PATCH(request({ action: "remove-received", shareId: unrelatedId }))).status, 403);
assert.equal((await PATCH(request({ action: "share", songId, destinationId: sourceId }))).status, 403);
let result = await GET(new Request("http://localhost:3000/api/production/sharing"));
assert.match(result.headers.get("cache-control"), /private, no-store/);
let payload = await result.json();
assert.equal(payload.incoming.length, 1);
assert.equal(payload.incoming[0].song.title, "Linked song");
assert.equal(payload.incoming[0].sourceWorkspaceName, "Romeo");
assert.ok(!JSON.stringify(payload).includes("Unrelated private song"));
rows.production_songs[0].title = "Updated at source";
payload = await (await GET(new Request("http://localhost:3000/api/production/sharing"))).json();
assert.equal(payload.incoming[0].song.title, "Updated at source", "recipient loads the canonical song, not a copy");
denied = true;
payload = await (await GET(new Request("http://localhost:3000/api/production/sharing"))).json();
assert.equal(payload.incoming.length, 0, "lost shared membership/frozen workspace blocks received reads");
const sql = await readFile(new URL("../supabase/migrations/202610170001_add_production_song_sharing.sql", import.meta.url), "utf8");
assert.match(sql, /foreign key \(production_song_id, source_workspace_id\)/);
assert.match(sql, /after insert on public.production_songs/);
assert.match(sql, /m\.role = 'admin'/);
assert.match(sql, /destination_workspace_id = p_workspace_id/);
assert.match(sql, /revoke all on public.production_song_shares, public.production_song_sharing_defaults from anon, authenticated/);
assert.doesNotMatch(sql, /create policy|update public.production_songs|update public.production_steps/i, "sharing never expands canonical RLS or rewrites the song");
console.log("Production sharing API permissions, isolation, canonical reads, revocation, and migration guard checks passed.");

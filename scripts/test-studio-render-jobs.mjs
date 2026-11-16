import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { validateRenderRequest, renderObjectPaths } from "../lib/studio/render-request.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const id = "11111111-1111-4111-8111-111111111111";
// Existing Love Strings workspace uses a PostgreSQL UUID with legacy version bits.
const workspaceId = "00000000-0000-0000-0000-000000000001";
const videoId = "33333333-3333-4333-8333-333333333333";
const body = { requestId: id, songId: id, audioSourceUrl: "https://res.cloudinary.com/test-cloud/video/upload/test.mp3", audioStart: 5, audioEnd: 20, videoAssetId: videoId, videoStart: 0, videoEnd: 2.733, durationSeconds: 15 };
assert.deepEqual(validateRenderRequest(body), body);
for (const invalid of [{ audioStart: NaN }, { videoEnd: Infinity }, { durationSeconds: 181 }, { audioEnd: 6 }, { videoEnd: 0 }, { videoAssetId: "../other" }]) assert.equal(validateRenderRequest({ ...body, ...invalid }), null);
assert.throws(() => renderObjectPaths("../other", id));
assert.throws(() => renderObjectPaths(`${workspaceId}/../other`, id));
assert.throws(() => renderObjectPaths(workspaceId, workspaceId), "Client request IDs retain RFC UUID validation");

let role = "admin";
let videoAvailable = true;
let authenticated = true;
let dispatched = 0;
let downloads = 0;
let rows = [];
let saves = [];
const client = { from(table) {
  const filters = [];
  let operation = "read", payload;
  const query = {
    select() { return query; }, order() { return query; }, limit() { return query; },
    eq(k, v) { filters.push((r) => r[k] === v); return query; }, in(k, vs) { filters.push((r) => vs.includes(r[k])); return query; },
    insert(value) { operation = "insert"; payload = value; return query; },
    update(value) { operation = "update"; payload = value; return query; },
    async result(single) {
      let records = table === "studio_projects" ? [{ id, workspace_id: workspaceId, production_song_id: id }] : table === "studio_audio_assets" ? [{ id, studio_project_id: id, workspace_id: workspaceId, asset_kind: "song-source", is_current: true, cloudinary_url: "https://res.cloudinary.com/test-cloud/video/upload/test.mp3" }] : table === "studio_workspace_video_assets" && videoAvailable ? [{ id: videoId, workspace_id: workspaceId, object_path: `workspaces/${workspaceId}/studio/uploads/${videoId}.mov`, duration_seconds: 2.733 }] : table === "studio_render_jobs" ? rows : [];
      records = records.filter((r) => filters.every((filter) => filter(r)));
      if (operation === "insert") { const r = { ...payload, created_at: new Date().toISOString(), failure_message: null }; rows.push(r); records = [r]; }
      if (operation === "update") records.forEach((r) => Object.assign(r, payload));
      return { data: single ? records[0] ?? null : records, error: null };
    },
    maybeSingle() { return query.result(true); }, single() { return query.result(true); },
    then(resolve, reject) { return query.result(false).then(resolve, reject); }
  };
  return query;
} };
class AccessError extends Error { status = 401; }
const storage = { bucket(bucket) { return { file(path) { return { getMetadata: async () => [{ size: 10 }], save: async (value) => saves.push({ bucket, path, value: String(value) }) }; } }; } };
const stubs = {
  "@/lib/server/workspace-owner": { WorkspaceAccessError: AccessError, requireWorkspaceAccess: async () => { if (!authenticated) throw new AccessError("Sign in required"); return { serviceClient: client, workspaceId, role, user: { id } }; } },
  "@/lib/server/adstudio-storage": { studioStagingBucketName: () => "stage", studioStorage: async () => storage },
  "@/lib/server/studio-render-jobs": { dispatchStudioRender: async () => { dispatched++; return "projects/test/locations/test/operations/test"; }, refreshStudioRenderJob: async (_, job) => job, toStudioRenderReply: (job) => ({ id: job.id, status: job.status }) },
  "@/lib/studio/render-request": { validateRenderRequest, renderObjectPaths, isStudioUuid: (value) => /^[0-9a-f-]{36}$/.test(value) }
};
const compiled = ts.transpileModule(fs.readFileSync(new URL("../app/api/studio/render-jobs/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function("require", "exports", compiled)((name) => stubs[name] ?? require(name), exports);
const originalFetch = globalThis.fetch;
const oldEnabled = process.env.ADSTUDIO_RENDER_ENABLED;
const oldCloud = process.env.CLOUDINARY_CLOUD_NAME;
const oldBucket = process.env.ADSTUDIO_RENDER_BUCKET;
globalThis.fetch = async () => { downloads++; return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": "3" } }); };
process.env.ADSTUDIO_RENDER_ENABLED = "true";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.ADSTUDIO_RENDER_BUCKET = "renders";
const request = (origin = "https://artistdeck.test", input = body) => ({ headers: new Headers({ origin, host: "artistdeck.test" }), json: async () => input });
try {
  assert.equal((await exports.POST(request("https://other.test"))).status, 401);
  authenticated = false;
  assert.equal((await exports.POST(request())).status, 401);
  authenticated = true; role = "viewer";
  assert.equal((await exports.POST(request())).status, 403);
  role = "admin"; process.env.ADSTUDIO_RENDER_ENABLED = "false";
  assert.equal((await exports.POST(request())).status, 503);
  process.env.ADSTUDIO_RENDER_ENABLED = "true"; videoAvailable = false;
  assert.equal((await exports.POST(request())).status, 400);
  assert.equal(dispatched, 0); assert.equal(downloads, 0);
  videoAvailable = true;
  assert.equal((await exports.POST(request(undefined, { ...body, audioSourceUrl: "https://other.test/source.mp3" }))).status, 409);
  assert.equal(downloads, 0);
  const response = await exports.POST(request());
  assert.equal(response.status, 202);
  assert.equal((await response.json()).job.status, "running");
  assert.equal(dispatched, 1); assert.equal(downloads, 1);
  const manifest = JSON.parse(saves.find((s) => s.path.endsWith("manifest.json")).value);
  assert.equal(manifest.video_uri, `gs://stage/workspaces/${workspaceId}/studio/uploads/${videoId}.mov`);
  assert.equal(manifest.audio_start_seconds, 5);
  assert.equal(manifest.video_end_seconds, 2.733);
  assert.equal(manifest.output_uri, `gs://renders/${renderObjectPaths(workspaceId, id).output}`);
  assert.equal((await exports.POST(request())).status, 200);
  assert.equal(dispatched, 1, "Same request ID must not launch a second render");
  assert.equal((await exports.POST(request(undefined, { ...body, requestId: videoId }))).status, 409);
  rows = []; saves = [];
  console.log("Render authorization, activation, workspace resolution, manifest and idempotency tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, old] of [["ADSTUDIO_RENDER_ENABLED", oldEnabled], ["CLOUDINARY_CLOUD_NAME", oldCloud], ["ADSTUDIO_RENDER_BUCKET", oldBucket]]) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
}

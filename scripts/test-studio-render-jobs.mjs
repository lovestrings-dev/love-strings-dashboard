import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { validateRenderRequest, renderObjectPaths } from "../lib/studio/render-request.ts";
import { overlayIdentity, validateOverlaySnapshot, defaultOverlayComposition, compositionForVideo, videoOverlayKey, ensureVideoOverlaySets, updateVideoOverlayLayer } from "../lib/studio/overlays.ts";
import { canManageStudioRenders } from "../lib/server/studio-render-access.ts";
assert.equal(canManageStudioRenders({ email: "DIMASOUNDER@GMAIL.COM", email_confirmed_at: "2026-01-01" }, "admin"), true);
assert.equal(canManageStudioRenders({ email: "dimasounder@gmail.com.evil.test", email_confirmed_at: "2026-01-01" }, "admin"), false);
const require = createRequire(import.meta.url);
const ts = require("typescript");
const id = "11111111-1111-4111-8111-111111111111";
// Existing Love Strings workspace uses a PostgreSQL UUID with legacy version bits.
const workspaceId = "00000000-0000-0000-0000-000000000001";
const videoId = "33333333-3333-4333-8333-333333333333";
const body = { batchId: "44444444-4444-4444-8444-444444444444", startBatch: true, requestId: id, songId: id, audioSourceUrl: "https://res.cloudinary.com/test-cloud/video/upload/test.mp3", audioStart: 5, audioEnd: 20, videoAssetId: videoId, videoStart: 0, videoEnd: 2.733, durationSeconds: 15 };
assert.deepEqual(validateRenderRequest(body), body);
assert.equal(validateRenderRequest({...body,includeOverlays:"false"}),null);
assert.equal(validateRenderRequest({...body,includeOverlays:false}).includeOverlays,false);
for (const invalid of [{ audioStart: NaN }, { videoEnd: Infinity }, { durationSeconds: 181 }, { audioEnd: 6 }, { videoEnd: 0 }, { videoAssetId: "../other" }]) assert.equal(validateRenderRequest({ ...body, ...invalid }), null);
assert.throws(() => renderObjectPaths("../other", id));
assert.throws(() => renderObjectPaths(`${workspaceId}/../other`, id));
assert.throws(() => renderObjectPaths(workspaceId, workspaceId), "Client request IDs retain RFC UUID validation");

let role = "admin";
let email = "dimasounder@gmail.com";
let confirmed = "2026-01-01T00:00:00Z";
let videoAvailable = true;
let selectedPixabay = true;
let overlaySnapshot = null;
let stagedLayers = [];
let stagedPixabay = [];
let authenticated = true;
let dispatched = 0;
let downloads = 0;
let rows = [];
let saves = [];
const client = { from(table) {
  const filters = [];
  let operation = "read", payload;
  const query = {
    select() { return query; }, is(k, v) { filters.push((r) => (r[k] ?? null) === v); return query; }, order() { return query; }, limit() { return query; },
    eq(k, v) { filters.push((r) => r[k] === v); return query; }, in(k, vs) { filters.push((r) => vs.includes(r[k])); return query; },
    insert(value) { operation = "insert"; payload = value; return query; },
    update(value) { operation = "update"; payload = value; return query; },
    async result(single) {
      let records = table === "studio_projects" ? [{ id, title: "Intro", workspace_id: workspaceId, production_song_id: id }] : table === "studio_audio_assets" ? [{ id, studio_project_id: id, workspace_id: workspaceId, asset_kind: "song-source", is_current: true, cloudinary_url: "https://res.cloudinary.com/test-cloud/video/upload/test.mp3" }] : table === "studio_workspace_video_assets" && videoAvailable ? [{ id: videoId, workspace_id: workspaceId, object_path: `workspaces/${workspaceId}/studio/uploads/${videoId}.mov`, original_file_name: "video.mov", duration_seconds: 2.733 }] : table === "studio_workspace_selection_drafts" ? [{ workspace_id: workspaceId, overlay_composition: overlaySnapshot?.composition, overlay_revision: overlaySnapshot?.revision, pixabay_video_snippets: selectedPixabay ? [{ id: "125", previewVideoUrl: "https://attacker.test/ignored.mp4" }] : [] }] : table === "studio_render_jobs" ? rows : table === "studio_rendered_assets" ? rows.map((r) => ({ workspace_id: r.workspace_id, render_job_id: r.id, object_path: r.output_object_path })) : [];
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
const storage = { bucket(bucket) { return { file(path) { return { getMetadata: async () => [{ size: 10 }], getSignedUrl: async () => ["https://example.test/private-output.mp4"], save: async (value) => saves.push({ bucket, path, value: String(value) }) }; } }; } };
let purgeFailure = false;
let purges = 0;
const stubs = {
  "@/lib/studio/overlays": { overlayIdentity, validateOverlaySnapshot, compositionForVideo, videoOverlayKey },
  "@/lib/server/studio-overlays": { authorizeOverlaySources: async () => {}, stageOverlayLayers: async (...args) => { stagedLayers.push(args); return [{ image_uri: "gs://stage/overlay.png", x: .5, y: .5, start_seconds: 0, end_seconds: 15 }]; } },
  "@/lib/server/studio-pixabay-render": { resolvePixabayRenderVideo: async (id) => ({ id, durationSeconds: 27, tags: "Stars", pageUrl: "https://pixabay.com/videos/id-125/", creator: "Artist", previewVideoUrl: "https://cdn.pixabay.com/video/source.mp4" }), stagePixabayRenderVideo: async (url) => stagedPixabay.push(url) },
  "@/lib/server/studio-media-retention": { purgePreviousStudioOutputs: async () => { purges++; if (purgeFailure) throw new Error("Cleanup failed"); }, deleteStudioRenderObject: async () => {} },
  "@/lib/server/studio-render-access": { canManageStudioRenders },
  "@/lib/server/workspace-owner": { WorkspaceAccessError: AccessError, requireWorkspaceAccess: async () => { if (!authenticated) throw new AccessError("Sign in required"); return { serviceClient: client, workspaceId, role, user: { id, email, email_confirmed_at: confirmed } }; } },
  "@/lib/server/adstudio-storage": { studioStagingBucketName: () => "stage", studioRenderBucketName: () => "renders", studioStorage: async () => storage },
  "@/lib/server/studio-render-jobs": { dispatchStudioRender: async () => { dispatched++; return "projects/test/locations/test/operations/test"; }, refreshStudioRenderJob: async (_, job) => job, toStudioRenderReply: (job) => ({ id: job.id, status: job.status }) },
  "@/lib/studio/render-request": { validateRenderRequest, renderObjectPaths, isStudioUuid: (value) => /^[0-9a-f-]{36}$/.test(value) }
};
const compiled = ts.transpileModule(fs.readFileSync(new URL("../app/api/studio/render-jobs/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function("require", "exports", compiled)((name) => stubs[name] ?? require(name), exports);
const deleteExports = {};
const deleteCompiled = ts.transpileModule(fs.readFileSync(new URL("../app/api/studio/render-jobs/[jobId]/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function("require", "exports", deleteCompiled)((name) => stubs[name] ?? require(name), deleteExports);
const previewExports = {};
const previewCompiled = ts.transpileModule(fs.readFileSync(new URL("../app/api/studio/render-jobs/[jobId]/preview/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function("require", "exports", previewCompiled)((name) => stubs[name] ?? require(name), previewExports);
const originalFetch = globalThis.fetch;
const oldEnabled = process.env.ADSTUDIO_RENDER_ENABLED;
const oldCloud = process.env.CLOUDINARY_CLOUD_NAME;
const oldBucket = process.env.ADSTUDIO_RENDER_BUCKET;
globalThis.fetch = async () => { downloads++; return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": "3" } }); };
process.env.ADSTUDIO_RENDER_ENABLED = "true";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.ADSTUDIO_RENDER_BUCKET = "renders";
const request = (origin = "https://artistdeck.test", input = body) => ({ headers: new Headers({ origin, host: "artistdeck.test" }), json: async () => input, nextUrl: new URL("https://artistdeck.test/api/studio/render-jobs") });
try {
  assert.equal((await exports.POST(request("https://other.test"))).status, 401);
  authenticated = false;
  assert.equal((await exports.POST(request())).status, 401);
  authenticated = true; role = "viewer";
  assert.equal((await exports.POST(request())).status, 403);
  role = "admin";
  for (const otherRole of ["admin", "member", "owner"]) {
    role = otherRole; email = "someone@example.com";
    assert.equal((await exports.POST(request(undefined, { ...body, email: "dimasounder@gmail.com" }))).status, 403, "Payload cannot spoof authorized email");
    const read = await exports.GET({ nextUrl: new URL("https://artistdeck.test/api/studio/render-jobs") });
    assert.equal(read.status, 200, "Other workspace accounts retain read access");
    const payload = await read.json();
    assert.equal(payload.canGenerate, false); assert.equal(payload.canDelete, false);
  }
  role = "admin"; email = "dimasounder@gmail.com"; confirmed = "";
  assert.equal((await exports.POST(request())).status, 403, "Unconfirmed email cannot generate");
  confirmed = "2026-01-01T00:00:00Z";
  assert.equal(dispatched, 0); assert.equal(downloads, 0); assert.equal(rows.length, 0);
  const ownRead = await exports.GET({ nextUrl: new URL("https://artistdeck.test/api/studio/render-jobs") });
  assert.equal((await ownRead.json()).canGenerate, true);
  process.env.ADSTUDIO_RENDER_ENABLED = "false";
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
  assert.equal(rows[0].result_details.audioTitle, "Intro");
  assert.equal(rows[0].result_details.videoName, "video.mov");
  const context = { params: Promise.resolve({ jobId: id }) };
  assert.equal((await deleteExports.DELETE(request("https://other.test"), context)).status, 401);
  role = "viewer";
  assert.equal((await deleteExports.DELETE(request(), context)).status, 403);
  role = "admin";
  assert.equal((await deleteExports.DELETE(request(), context)).status, 409, "Running jobs cannot be deleted");
  rows[0].status = "succeeded";
  email = "someone@example.com";
  assert.equal((await deleteExports.DELETE(request(), context)).status, 403, "Other admins are view-only for results");
  const otherPreview = await previewExports.GET(request(), context);
  assert.equal(otherPreview.status, 307, "Other accounts retain signed preview access");
  assert.equal(otherPreview.headers.get("location"), "https://example.test/private-output.mp4");
  role = "viewer";
  assert.equal((await previewExports.GET(request(), context)).status, 307, "Workspace viewers retain signed preview access");
  role = "admin";
  email = "dimasounder@gmail.com";
  const originalWorkspace = rows[0].workspace_id;
  rows[0].workspace_id = videoId;
  assert.equal((await deleteExports.DELETE(request(), context)).status, 404, "Other workspace is inaccessible");
  rows[0].workspace_id = originalWorkspace;
  assert.equal((await deleteExports.DELETE(request(), context)).status, 200);
  assert.ok(rows[0].deleted_at);
  assert.equal(rows.length, 1, "Soft delete preserves audit row");
  assert.equal((await deleteExports.DELETE(request(), context)).status, 200, "Delete is idempotent");
  assert.equal((await previewExports.GET(request(), context)).status, 404, "Deleted result cannot mint preview links");
  assert.equal((await exports.POST(request())).status, 410, "Deleted request must not relaunch");
  assert.equal(dispatched, 1);
  assert.equal(purges, 1);
  rows = []; purgeFailure = true;
  assert.equal((await exports.POST(request(undefined, { ...body, requestId: videoId }))).status, 503);
  assert.equal(dispatched, 1, "Cleanup failure must prevent another cloud execution");
  assert.equal(rows[0].status, "failed");
  rows = [];
  const history = await exports.GET({ nextUrl: new URL("https://artistdeck.test/api/studio/render-jobs") });
  assert.deepEqual((await history.json()).jobs, [], "Deleted results are absent from history");
  rows = []; saves = []; purgeFailure = false;
  const { videoAssetId: _upload, ...basePixabay } = body;
  const pixabayBody = { ...basePixabay, pixabayVideoId: "125", videoEnd: 27 };
  selectedPixabay = false;
  assert.equal((await exports.POST(request(undefined, pixabayBody))).status, 409, "Unsaved Pixabay selection is rejected");
  assert.equal(stagedPixabay.length, 0);
  selectedPixabay = true;
  assert.equal((await exports.POST(request(undefined, { ...pixabayBody, videoEnd: 28 }))).status, 400, "Provider duration bounds the request");
  assert.equal((await exports.POST(request(undefined, pixabayBody))).status, 202);
  assert.equal(stagedPixabay[0], "https://cdn.pixabay.com/video/source.mp4", "Draft URL is never used for staging");
  assert.equal(JSON.parse(saves.find((s) => s.path.endsWith("manifest.json")).value).video_uri, `gs://stage/${renderObjectPaths(workspaceId, id).video}`);
  assert.equal(rows[0].result_details.pixabayVideoId, "125");
  assert.equal(rows[0].result_details.videoAssetId, undefined);
  assert.equal((await exports.POST(request(undefined, pixabayBody))).status, 200, "Pixabay request retry is idempotent");
  assert.equal(stagedPixabay.length, 1);
  rows = []; saves = [];
  let linked=ensureVideoOverlaySets(defaultOverlayComposition(15),[`upload:${videoId}`,'pixabay:125']);
  linked=updateVideoOverlayLayer(linked,'pixabay:125',{...linked.layers[2],text:'PIXABAY SET'});
  overlaySnapshot = { revision: 1, composition: linked };
  const layered = { ...pixabayBody, requestId: videoId, overlaySnapshot };
  assert.equal((await exports.POST(request(undefined, { ...layered, overlaySnapshot: { ...overlaySnapshot, revision: 0 } }))).status, 409, "Stale preview must not render");
  assert.equal((await exports.POST(request(undefined, layered))).status, 202);
  const layeredManifest = JSON.parse(saves.find((s) => s.path.endsWith("manifest.json")).value);
  assert.equal(layeredManifest.overlay_schema_version, 2);
  assert.equal(layeredManifest.overlay_layers.length, 1);
  assert.deepEqual(rows[0].result_details.overlaySnapshot, overlaySnapshot);
  assert.equal(stagedLayers.length, 1);
  assert.equal(stagedLayers[0][2].layers[2].text,'PIXABAY SET','Manifest staging resolves this source’s own set');
  assert.equal(stagedLayers[0][2].videoSets,undefined,'Only the selected layers reach raster staging');
  rows[0].status = "succeeded";
  const originalSnapshot = structuredClone(overlaySnapshot);
  overlaySnapshot = { ...overlaySnapshot, revision: 2 };
  assert.equal((await exports.POST(request(undefined, { ...layered, requestId: id, startBatch: false, overlaySnapshot: originalSnapshot }))).status, 202, "Remaining pairs use the frozen first-pair snapshot after an edit");
  rows.forEach(row=>row.status='succeeded');
  assert.equal((await exports.POST(request(undefined,{...body,requestId:'55555555-5555-4555-8555-555555555555',startBatch:false,batchId:layered.batchId,overlaySnapshot:originalSnapshot}))).status,202,'Uploaded source can join the same frozen batch');
  assert.equal(stagedLayers.at(-1)[2].layers[2].text,'OUT NOW','Upload uses its own set, not the Pixabay set');
  rows.forEach(row=>row.status='succeeded'); saves=[];
  const layerStages=stagedLayers.length;
  assert.equal((await exports.POST(request(undefined,{...body,requestId:'66666666-6666-4666-8666-666666666666',startBatch:false,batchId:layered.batchId,overlaySnapshot:originalSnapshot,includeOverlays:false}))).status,202);
  assert.equal(stagedLayers.length,layerStages,'Excluded overlays are never raster-staged');
  assert.deepEqual(JSON.parse(saves.find(save=>save.path.endsWith('manifest.json')).value).overlay_layers,[],'The worker receives no layers for an unchecked overlay set');
  assert.equal(rows.at(-1).result_details.includeOverlays,false,'History preserves the render choice');
  assert.equal(validateRenderRequest({...body,overlaySnapshot:originalSnapshot,overlaySetKey:'pixabay:999'}),null,'Unknown sets cannot be requested');
  assert.equal(validateRenderRequest({...body,overlaySnapshot:originalSnapshot,overlaySetKey:'pixabay:125',includeOverlays:false}),null);
  rows.forEach(row=>row.status='succeeded');
  assert.equal((await exports.POST(request(undefined,{...body,requestId:'77777777-7777-4777-8777-777777777777',startBatch:false,batchId:layered.batchId,overlaySnapshot:originalSnapshot,overlaySetKey:'pixabay:125'}))).status,202);
  assert.equal(stagedLayers.at(-1)[2].layers[2].text,'PIXABAY SET','Uploaded footage can render with the selected Pixabay-authored set');
  assert.equal(rows.at(-1).result_details.overlaySetKey,'pixabay:125');
  assert.equal(rows.at(-1).result_details.overlaySetLabel,'Overlay set 2');
  rows.forEach(row=>row.status='succeeded');
  assert.equal((await exports.POST(request(undefined,{...pixabayBody,requestId:'88888888-8888-4888-8888-888888888888',startBatch:false,batchId:layered.batchId,overlaySnapshot:originalSnapshot,overlaySetKey:`upload:${videoId}`}))).status,202);
  assert.equal(stagedLayers.at(-1)[2].layers[2].text,'OUT NOW','Pixabay footage can render with the selected upload-authored set');
  console.log("Render authorization, activation, workspace resolution, manifest and idempotency tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, old] of [["ADSTUDIO_RENDER_ENABLED", oldEnabled], ["CLOUDINARY_CLOUD_NAME", oldCloud], ["ADSTUDIO_RENDER_BUCKET", oldBucket]]) { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
}

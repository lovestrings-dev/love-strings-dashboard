import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { streamVideoZip, validateZipVideos } from "../lib/server/studio-download-zip.ts";
const chunks = [];
const files = Array.from({ length: 8 }, (_, i) => ({ name: `Video-${i + 1}.mp4`, size: 3000 + i, open: async function* () { yield Buffer.alloc(1000, i); yield Buffer.alloc(2000 + i, i); } }));
for await (const chunk of streamVideoZip(files)) chunks.push(chunk);
const archive = Buffer.concat(chunks);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "artistdeck-zip-"));
try {
  fs.writeFileSync(path.join(temp, "videos.zip"), archive);
  const result = spawnSync("python3", ["-c", 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert len(z.namelist())==8; [None if z.read("Video-%d.mp4"%(i+1))==bytes([i])*(3000+i) else sys.exit(1) for i in range(8)]', path.join(temp, "videos.zip")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
assert.throws(() => validateZipVideos([]));
assert.throws(() => validateZipVideos([...files, files[0]]));
assert.throws(() => validateZipVideos([{ ...files[0], name: "../escape.mp4" }]));
assert.throws(() => validateZipVideos([{ ...files[0], size: 0xffffffff }]));
assert.throws(() => validateZipVideos([files[0], files[0]]));
await assert.rejects(async () => { for await (const chunk of streamVideoZip([{ ...files[0], size: 1 }])) void chunk; }, /changed/);
await assert.rejects(async () => { for await (const chunk of streamVideoZip([{ ...files[0], size: 9999 }])) void chunk; }, /Incomplete/);

const require = createRequire(import.meta.url), ts = require("typescript");
const id = "11111111-1111-4111-8111-111111111111", workspaceId = "00000000-0000-0000-0000-000000000001";
let authenticated = true, available = true, unsafe = false, opened = 0;
class WorkspaceAccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const client = { from(table) {
  const query = { select() { return query; }, eq(k, v) { if (k === "workspace_id") assert.equal(v, workspaceId); return query; }, is(k, v) { assert.equal(k, "deleted_at"); assert.equal(v, null); return query; }, in() { return query; }, then(resolve) { return Promise.resolve({ data: table === "studio_render_jobs" ? (available ? [{ id }] : []) : [{ render_job_id: id, object_path: unsafe ? "workspaces/other/studio/renders/final.mp4" : `workspaces/${workspaceId}/studio/renders/${id}/final.mp4` }], error: null }).then(resolve); } }; return query;
} };
const source = fs.readFileSync(new URL("../app/api/studio/render-jobs/download/route.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", output)((name) => {
  if (name === "next/server") return { NextResponse: { json: (data, init) => Response.json(data, init) } };
  if (name.endsWith("workspace-owner")) return { WorkspaceAccessError, requireWorkspaceAccess: async () => { if (!authenticated) throw new WorkspaceAccessError("Sign in", 401); return { serviceClient: client, workspaceId, role: "viewer", user: { email: "other@example.com" } }; } };
  if (name.endsWith("adstudio-storage")) return { studioRenderBucketName: () => "outputs", studioStorage: async () => ({ bucket: () => ({ file: () => ({ getMetadata: async () => [{ size: 3 }], createReadStream: async function* () { opened++; yield Buffer.from("mp4"); } }) }) }) };
  if (name.endsWith("render-request")) return { isStudioUuid: value => /^[a-f0-9-]{36}$/.test(value) };
  if (name.endsWith("studio-download-zip")) return { streamVideoZip, validateZipVideos };
  return require(name);
}, mod, mod.exports);
const get = (query = `id=${id}`) => mod.exports.GET({ nextUrl: new URL(`http://localhost/api/studio/render-jobs/download?${query}`) });
let response = await get();
assert.equal(response.status, 200, "Other workspace users, including Viewers, can download existing results");
assert.match(response.headers.get("Content-Disposition"), /ArtistDeck-videos.zip/);
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
assert.ok((await response.arrayBuffer()).byteLength > 3);
assert.equal(opened, 1);
authenticated = false; assert.equal((await get()).status, 401); authenticated = true;
assert.equal((await get("")).status, 400);
assert.equal((await get(`id=${id}&id=${id}`)).status, 400);
available = false; assert.equal((await get()).status, 404); available = true;
unsafe = true; assert.equal((await get()).status, 404);
assert.equal(opened, 1, "Rejected requests never open a cloud stream");
console.log("Studio bulk ZIP download: archive integrity, streaming bounds, workspace access and Viewer downloads passed.");

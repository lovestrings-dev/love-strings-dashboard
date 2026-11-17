import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { normalizePixabayVideoSearch } from '../lib/studio/pixabay.ts';
import { validateRenderRequest } from '../lib/studio/render-request.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const api = {};
new Function('require', 'exports', ts.transpileModule(fs.readFileSync(new URL('../lib/server/studio-pixabay-render.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)((name) => name === '../studio/pixabay' ? { normalizePixabayVideoSearch } : require(name), api);
const originalFetch = globalThis.fetch;
const originalKey = process.env.PIXABAY_API_KEY;
process.env.PIXABAY_API_KEY = 'offline-fixture';
let source = 'https://cdn.pixabay.com/video/2026/125.mp4';
let deleted = 0;
let written = [];
const file = { createWriteStream: () => new Writable({ write(chunk, _encoding, cb) { written.push(chunk); cb(); } }), delete: async () => { deleted++; } };
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, 'pixabay.com');
    assert.equal(new URL(url).searchParams.get('id'), '125');
    assert.equal(options.redirect, 'error');
    return Response.json({hits:[{id:125,duration:27,pageURL:'https://pixabay.com/videos/id-125/',tags:'Stars',user:'Artist',videos:{large:{url:source,thumbnail:'https://cdn.pixabay.com/poster.jpg',width:1080,height:1920}}}]});
  };
  assert.equal((await api.resolvePixabayRenderVideo('125')).previewVideoUrl,source);
  for (const bad of ['https://attacker.test/video/a.mp4','http://cdn.pixabay.com/video/a.mp4','https://cdn.pixabay.com.attacker.test/video/a.mp4','https://user@cdn.pixabay.com/video/a.mp4','https://cdn.pixabay.com:8443/video/a.mp4','https://cdn.pixabay.com/photo/a.mp4']) {
    source = bad;
    await assert.rejects(()=>api.resolvePixabayRenderVideo('125'),/Unsupported/);
  }
  await assert.rejects(()=>api.resolvePixabayRenderVideo('../125'),/Invalid/);
  globalThis.fetch = async (_url, options) => { assert.equal(options.redirect,'error'); return new Response(new Uint8Array([1,2,3])); };
  await api.stagePixabayRenderVideo('https://cdn.pixabay.com/video/a.mp4',file,4);
  assert.equal(Buffer.concat(written).length,3);
  await assert.rejects(()=>api.stagePixabayRenderVideo('https://cdn.pixabay.com/video/a.mp4',file,2),/limit/);
  assert.equal(deleted,1,'Oversized stream cleans only its own temporary object');
  globalThis.fetch = async () => new Response(new Uint8Array());
  await assert.rejects(()=>api.stagePixabayRenderVideo('https://cdn.pixabay.com/video/a.mp4',file),/empty/);
  assert.equal(deleted,2);
  globalThis.fetch = async () => new Response('redirect',{status:302,headers:{location:'http://localhost/private'}});
  await assert.rejects(()=>api.stagePixabayRenderVideo('https://cdn.pixabay.com/video/a.mp4',file),/downloaded/);
  const request={requestId:'11111111-1111-4111-8111-111111111111',songId:'22222222-2222-4222-8222-222222222222',pixabayVideoId:'125',audioSourceUrl:'https://example.test/a.mp3',audioStart:0,audioEnd:15,videoStart:0,videoEnd:27,durationSeconds:15};
  assert.deepEqual(validateRenderRequest(request),request);
  assert.equal(validateRenderRequest({...request,videoAssetId:request.songId}),null,'Ambiguous sources are rejected');
  assert.equal(validateRenderRequest({...request,pixabayVideoId:'https://attacker.test/a.mp4'}),null);
  console.log('Pixabay ID lookup, CDN boundaries, bounded streaming, cleanup and source validation passed.');
} finally {
  globalThis.fetch = originalFetch;
  if(originalKey===undefined) delete process.env.PIXABAY_API_KEY; else process.env.PIXABAY_API_KEY=originalKey;
}

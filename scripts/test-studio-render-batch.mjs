import assert from 'node:assert/strict';
import { createRenderBatch } from '../lib/studio/render-batch.ts';
const a = [
  { id: 'a1', songId: 'song', sourceUrl: 'https://example.test/audio', title: 'Intro', start: 5, end: 20 },
  { id: 'a2', songId: 'song', sourceUrl: 'https://example.test/audio', title: 'Intro', start: 25, end: 40 }
];
const v = [
  { key: 'v1', assetId: 'video1', fileName: 'one.mov', start: 2, end: 4 },
  { key: 'v2', assetId: 'video2', fileName: 'two.mp4', start: 1, end: 8 }
];
let n = 0;
const batch = createRenderBatch(a, v, 15, () => `id-${++n}`);
assert.equal(batch.pairs.length, 4);
assert.deepEqual(batch.pairs.map(p => [p.request.audioStart, p.request.videoAssetId]), [[5,'video1'],[5,'video2'],[25,'video1'],[25,'video2']]);
assert.equal(new Set(batch.pairs.map(p => p.request.requestId)).size, 4);
assert.deepEqual(JSON.parse(JSON.stringify(batch)), batch, 'Reload snapshot retains pair IDs and exact trims');
assert.equal(batch.pairs[0].request.videoStart, 2);
assert.equal(batch.pairs[2].request.audioEnd, 40);
assert.throws(() => createRenderBatch([], v, 15, () => 'x'));
assert.throws(() => createRenderBatch([...a, a[0]], v, 15, () => 'x'));
assert.throws(() => createRenderBatch([{...a[0],end:6}], v, 15, () => 'x'));
assert.equal(createRenderBatch(a.slice(0,1),v,15,()=>`id-${++n}`).pairs.length,2);
console.log('2×2 Cartesian combinations, bounded selections, exact trims and stable reload IDs passed.');

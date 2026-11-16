import assert from 'node:assert/strict';
import { createRenderBatch, findRenderForPair } from '../lib/studio/render-batch.ts';
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

// A second browser has no device batch plan. Pair matching must ignore old
// exports without labels and preserve all four current pair positions.
const currentJobs = batch.pairs.map((p, i) => ({id:`new-${i}`,details:{audioTitle:p.audioTitle,audioStart:p.request.audioStart,audioEnd:p.request.audioEnd,videoName:p.videoName,videoStart:p.request.videoStart,videoEnd:p.request.videoEnd,durationSeconds:15}}));
const mixedHistory = [{id:'old-1',details:null},...currentJobs.slice().reverse(),{id:'old-2',details:null}];
assert.deepEqual(a.flatMap(audio=>v.map(video=>findRenderForPair(audio,video,15,mixedHistory)?.id)),['new-0','new-1','new-2','new-3']);
assert.equal(findRenderForPair(a[1],v[1],15,mixedHistory.filter(j=>j.id!=='new-3')),undefined,'Missing fourth pair stays waiting; no previous export fills it');
assert.equal(findRenderForPair(a[0],v[0],30,mixedHistory),undefined);
assert.equal(findRenderForPair({...a[0],start:6},v[0],15,mixedHistory),undefined);
assert.equal(findRenderForPair(a[0],{...v[0],start:3},15,mixedHistory),undefined);
const identityJob={...currentJobs[0],details:{...currentJobs[0].details,songId:'other-song',videoAssetId:'other-video'}};
assert.equal(findRenderForPair(a[0],v[0],15,[identityJob]),undefined,'Stable IDs take precedence over duplicate filenames/titles');
console.log('Cross-device preview pair matching ignores older exports and preserves missing-pair placeholders.');

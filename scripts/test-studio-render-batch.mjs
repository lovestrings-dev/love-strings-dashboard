import assert from 'node:assert/strict';
import { createRenderBatch, renderCombinations, exportVideoChoices, findRenderForPair } from '../lib/studio/render-batch.ts';
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

const pixabay = { id: '125', tags: 'Stars', creator: 'Artist', pageUrl: 'https://pixabay.com/videos/id-125/', previewUrl: 'https://cdn.pixabay.com/poster.jpg', previewVideoUrl: 'https://cdn.pixabay.com/video/source.mp4', durationSeconds: 27, width: 1080, height: 1920 };
const choices = exportVideoChoices([{id:'video1', fileName:'one.mov'}], [{assetId:'video1',start:2,end:4},{assetId:'deleted',start:0,end:3}], [pixabay]);
assert.equal(choices.length, 2, 'Shared upload and saved Pixabay selection both reach Export; deleted uploads do not');
assert.equal(choices[1].pixabayVideoId, '125');
const mixed = createRenderBatch(a,choices,15,()=>`id-${++n}`);
assert.deepEqual(mixed.pairs.map(p=>p.request.videoAssetId ?? p.request.pixabayVideoId),['video1','125','video1','125']);
assert.equal(mixed.pairs[1].request.videoAssetId,undefined);
const pixabayJob={details:{...currentJobs[0].details,videoAssetId:undefined,pixabayVideoId:'125',videoName:'Stars · Pixabay',videoStart:0,videoEnd:27}};
assert.equal(findRenderForPair(a[0],choices[1],15,[pixabayJob]),pixabayJob);
assert.equal(findRenderForPair(a[0],choices[0],15,[pixabayJob]),undefined);
console.log('Saved Pixabay and mixed upload/Pixabay batch source identity passed.');

const overlaySets=[{key:'upload:11111111-1111-4111-8111-111111111111',label:'Overlay set 1'},{key:'pixabay:125',label:'Overlay set 2'}];
const composition={schemaVersion:2,layers:[],videoSets:overlaySets.map(set=>({videoKey:set.key,layers:[]}))};
const eight=createRenderBatch(a,v,15,()=>`eight-${++n}`,{revision:1,composition},[],overlaySets);
const planned=renderCombinations(a,v,overlaySets);
assert.equal(planned.length,8);assert.equal(eight.pairs.length,8);
assert.equal(new Set(planned.map(c=>c.key)).size,8);
assert.equal(new Set(eight.pairs.map(p=>JSON.stringify([p.request.audioStart,p.request.videoAssetId,p.request.overlaySetKey]))).size,8);
assert.deepEqual(eight.pairs.map(p=>p.request.overlaySetKey),Array(4).fill(overlaySets.map(s=>s.key)).flat());
assert.deepEqual(JSON.parse(JSON.stringify(eight)),eight,'All eight stable request IDs survive reopening');
assert.equal(renderCombinations(a,v,overlaySets.slice(0,1)).length,4);
assert.equal(renderCombinations(a.slice(0,1),v,overlaySets).length,4);
assert.equal(renderCombinations(a,v.slice(0,1),overlaySets).length,4);
assert.equal(renderCombinations(a,v,[]).length,4,'No selected overlays means one plain output per audio/video pair');
assert.ok(renderCombinations(a,v,[]).every(c=>!c.includeOverlays));
assert.throws(()=>renderCombinations(a,v,[overlaySets[0],overlaySets[0]]));
const variantJobs=eight.pairs.map((p,i)=>({id:`variant-${i}`,details:{...currentJobs[0].details,audioStart:p.request.audioStart,audioEnd:p.request.audioEnd,videoAssetId:p.request.videoAssetId,videoName:p.videoName,videoStart:p.request.videoStart,videoEnd:p.request.videoEnd,overlaySetKey:p.request.overlaySetKey,overlaySnapshot:p.request.overlaySnapshot}}));
assert.deepEqual(planned.map(c=>findRenderForPair(c.audio,c.video,15,variantJobs,{revision:1,composition},true,c.overlaySetKey)?.id),Array.from({length:8},(_,i)=>`variant-${i}`));
assert.equal(findRenderForPair(a[0],v[0],15,variantJobs.filter(j=>j.id!=='variant-1'),{revision:1,composition},true,overlaySets[1].key),undefined,'The other overlay variant cannot fill a missing slot');
console.log('2×2×2 plan, eight placeholders/requests, exact variant matching, selection counts and reload IDs passed.');

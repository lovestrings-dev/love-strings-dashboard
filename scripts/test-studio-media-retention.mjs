import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isStudioUuid, renderObjectPaths } from '../lib/studio/render-request.ts';
import { canManageStudioRenders } from '../lib/server/studio-render-access.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const ws = '00000000-0000-0000-0000-000000000001';
const otherWs = '00000000-0000-0000-0000-000000000002';
const ids = Array.from({length:8},(_,i)=>`${i+1}1111111-1111-4111-8111-111111111111`);
const [batch,oldBatch,oldId,new1,new2,orphan,assetId,newerBatch] = ids;
let state, jobs, assets, files, deleted, rpcCalls, activeReads, race, drafts;
let email = 'dimasounder@gmail.com', role = 'admin', failDeletion = false;
function reset() {
 state=[{workspace_id:ws,batch_id:oldBatch}];
 jobs=[{id:oldId,workspace_id:ws,batch_id:oldBatch,status:'succeeded'}, {id:new1,workspace_id:ws,batch_id:batch,status:'queued'}, {id:new2,workspace_id:ws,batch_id:batch,status:'succeeded'}];
 assets=[{id:assetId,workspace_id:ws,object_path:`workspaces/${ws}/studio/uploads/${assetId}.mov`,deleted_at:null}];
 files=[renderObjectPaths(ws,oldId).output,renderObjectPaths(ws,new1).output,renderObjectPaths(ws,new2).output,renderObjectPaths(ws,orphan).output,renderObjectPaths(otherWs,oldId).output,assets[0].object_path];
 drafts=[{workspace_id:ws,audio_snippets:[{id:"keep-audio"}],pixabay_video_snippets:[{id:"keep-pixabay"}],uploaded_video_snippets:[{assetId,start:0,end:2}]}];
 deleted=[];rpcCalls=[];activeReads=0;race=false; failDeletion=false;
}
reset();
const client={from(table){
 let predicates=[],operation='read',payload;
 const q={select(){return q},order(){return q},limit(){return q},
 eq(k,v){predicates.push(r=>r[k]===v);return q},is(k,v){predicates.push(r=>(r[k]??null)===v);return q},in(k,vs){predicates.push(r=>vs.includes(r[k]));return q},
 or(){predicates.push(r=>r.batch_id==null||r.batch_id!==batch);return q},
 update(v){operation='update';payload=v;return q},upsert(v){operation='upsert';payload=v;return q},
 async result(single){
  const records=table==='studio_render_retention_state'?state:table==='studio_render_jobs'?jobs:table==='studio_workspace_selection_drafts'?drafts:assets;
  if(table==='studio_render_jobs'&&operation==='read'){activeReads++;if(race&&activeReads===2)jobs.push({id:'racing',workspace_id:ws,status:'queued'});}
  if(operation==='upsert'){const existing=records.find(r=>r.workspace_id===payload.workspace_id);if(existing)Object.assign(existing,payload);else records.push(payload);}
  const matches=records.filter(r=>predicates.every(p=>p(r)));
  if(operation==='update')matches.forEach(r=>Object.assign(r,payload));
  return {data:single?(matches[0]??null):matches,error:null};
 },maybeSingle(){return q.result(true)},then(resolve,reject){return q.result(false).then(resolve,reject)}};return q;
},async rpc(name,args){rpcCalls.push({name,args});drafts.forEach(d=>{if(d.workspace_id===args.p_workspace_id)d.uploaded_video_snippets=d.uploaded_video_snippets.filter(s=>s.assetId!==args.p_asset_id)});return {error:null}}};
const storage={bucket(){return {async getFiles({prefix}){return [files.filter(n=>n.startsWith(prefix)).map(name=>({name,async delete(){if(failDeletion)throw new Error('GCS unavailable');deleted.push(name);files=files.filter(f=>f!==name)}}))]},file(name){return {async delete(){if(failDeletion)throw new Error('GCS unavailable');deleted.push(name);files=files.filter(f=>f!==name)}}}}}};
const storageStub={studioStorage:async()=>storage,studioRenderBucketName:()=> 'renders',studioStagingBucketName:()=> 'staging'};
function load(path,stubs){const output=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const exports={};new Function('require','exports',output)(name=>stubs[name]??require(name),exports);return exports;}
const retention=load('lib/server/studio-media-retention.ts',{'./adstudio-storage':storageStub,'../studio/render-request':{isStudioUuid,renderObjectPaths}});
await retention.purgePreviousStudioOutputs(client,ws,batch,true);
assert.equal(state[0].batch_id,batch);
assert.deepEqual(new Set(deleted),new Set([renderObjectPaths(ws,oldId).output,renderObjectPaths(ws,orphan).output]));
assert.ok(files.includes(renderObjectPaths(otherWs,oldId).output),'Other workspace survives');
assert.ok(files.includes(renderObjectPaths(ws,new2).output),'Earlier pair in current batch survives');
assert.ok(jobs[0].deleted_at);assert.equal(jobs[1].deleted_at,undefined);
await retention.purgePreviousStudioOutputs(client,ws,batch,false);
assert.equal(deleted.length,2,'Repeated cleanup leaves current batch intact');
state[0].batch_id=newerBatch;
await assert.rejects(()=>retention.purgePreviousStudioOutputs(client,ws,batch,false),/replaced/);
assert.equal(deleted.length,2,'Old device queue cannot purge newer outputs');
await assert.rejects(()=>retention.deleteStudioRenderObject(ws,new1,renderObjectPaths(otherWs,new1).output),/Invalid/);
await retention.deleteStudioRenderObject(ws,new1,renderObjectPaths(ws,new1).output);
assert.ok(!files.includes(renderObjectPaths(ws,new1).output));
reset();
class AccessError extends Error {status=401;}
const route=load('app/api/studio/video-uploads/[assetId]/route.ts',{
 '@/lib/server/adstudio-storage':storageStub,
 '@/lib/studio/render-request':{isStudioUuid},
 '@/lib/server/studio-render-access':{canManageStudioRenders},
 '@/lib/server/workspace-owner':{WorkspaceAccessError:AccessError,requireWorkspaceAccess:async()=>({serviceClient:client,workspaceId:ws,user:{email,email_confirmed_at:'2026-01-01'},role})}
});
const req=(origin='https://artistdeck.test')=>({headers:new Headers({origin,host:'artistdeck.test'})});
const context={params:Promise.resolve({assetId})};
assert.equal((await route.DELETE(req('https://foreign.test'),context)).status,401);
email='other@example.com';assert.equal((await route.DELETE(req(),context)).status,403);email='dimasounder@gmail.com';
assert.equal((await route.DELETE(req(),context)).status,409,'Active render blocks source deletion');assert.equal(deleted.length,0);
jobs=[];race=true;activeReads=0;
assert.equal((await route.DELETE(req(),context)).status,409,'Racing reservation blocks deletion');assert.equal(assets[0].deleted_at,null);assert.equal(deleted.length,0);
jobs=[];race=false;activeReads=0;
assert.equal((await route.DELETE(req(),context)).status,200);assert.equal(deleted[0],assets[0].object_path);assert.ok(assets[0].deleted_at);
assert.equal(rpcCalls[0].name,'studio_remove_deleted_video_from_draft');assert.deepEqual(rpcCalls[0].args,{p_workspace_id:ws,p_asset_id:assetId});
assert.deepEqual(drafts[0].uploaded_video_snippets,[]);assert.deepEqual(drafts[0].audio_snippets,[{id:"keep-audio"}]);
assert.equal((await route.DELETE(req(),context)).status,200,'Repeat deletion tolerates missing object');
reset();jobs=[];assets[0].workspace_id=otherWs;
assert.equal((await route.DELETE(req(),context)).status,404);assert.equal(deleted.length,0);
reset();jobs=[];failDeletion=true;
assert.equal((await route.DELETE(req(),context)).status,500);assert.ok(assets[0].deleted_at,'Failed deletion cannot be reused as source');assert.equal(rpcCalls.length,0);
failDeletion=false;assert.equal((await route.DELETE(req(),context)).status,200,'Retry completes same marked source');
console.log('Cloud retention: batch preservation, orphan cleanup, workspace isolation, stale queue rejection, actual result deletion and safe source deletion/retry passed.');

reset();jobs=[];
const selectionRoute=load('app/api/studio/selection-draft/route.ts',{'@/lib/server/workspace-owner':{WorkspaceAccessError:AccessError,requireWorkspaceAccess:async()=>({serviceClient:client,workspaceId:ws,user:{id:assetId},role:'admin'})}});
let read=await selectionRoute.GET(req());assert.equal((await read.json()).uploadedVideoSnippets.length,1);
assets[0].deleted_at=new Date().toISOString();
read=await selectionRoute.GET(req());assert.deepEqual((await read.json()).uploadedVideoSnippets,[],'Deleted sources do not return in other-device drafts');
assert.equal((await selectionRoute.PATCH({...req(),json:async()=>({uploadedVideoSnippets:[{assetId,start:0,end:2}]})})).status,409,'A stale browser cannot save a deleted source back into selection');
console.log('Deleted source selections are filtered from reads and rejected on stale writes.');

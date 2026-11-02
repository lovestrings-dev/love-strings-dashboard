import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evolutionInterval,evolutionSeries,evolutionDomain} from '../lib/platform-evolution.ts';
import {spotifyEvolutionCharts} from '../lib/spotify-evolution.ts';
const points=[{date:'2026-07-01',value:0},{date:'2026-08-01',value:10},{date:'2026-10-01',value:4}];
const charts=[{label:'Test',color:'green',points},{label:'Empty',color:'blue',points:[]}];
assert.deepEqual(evolutionInterval(charts,'30D','2026-11-02'),{start:'2026-10-04',end:'2026-11-02'});
assert.deepEqual(evolutionInterval(charts,'90D','2026-11-02'),{start:'2026-08-05',end:'2026-11-02'});
assert.deepEqual(evolutionInterval(charts,'1Y','2028-02-29'),{start:'2027-02-28',end:'2028-02-29'});
assert.deepEqual(evolutionInterval(charts,'All','2026-11-02'),{start:'2026-07-01',end:'2026-11-02'});
assert.deepEqual(evolutionInterval([],'All','2026-11-02'),{start:'2026-11-02',end:'2026-11-02'});
assert.deepEqual(evolutionSeries(points,'2026-10-04','2026-11-02','growth'),[],'Missing observations stay missing');
const growth=evolutionSeries(points,'2026-07-01','2026-11-02','growth');
assert.deepEqual(growth.map(p=>p.plottedValue),[0,10,4],'A recorded zero is a valid baseline');
assert.deepEqual(growth.map(p=>p.previousChange),[null,10,-6]);
assert.equal(evolutionSeries(points,'2026-09-01','2026-11-02','growth')[0].plottedValue,0,'Baseline uses first available selected observation');
assert.equal(evolutionSeries(points,'2026-09-01','2026-11-02','growth')[0].previousChange,-6,'Tooltip can compare to actual observation preceding interval');
assert.deepEqual(evolutionSeries(points,'2026-07-01','2026-11-02','absolute').map(p=>p.plottedValue),[0,10,4]);
assert.equal(evolutionSeries([{date:'2026-10-01',value:NaN}], '2026-01-01','2026-12-31','absolute').length,0);
for(const values of [[],[0],[3,3],[-10,0,5]]){const domain=evolutionDomain(values);assert.ok(domain.max>domain.min);for(const value of values)assert.ok(value>=domain.min&&value<=domain.max);}
const row=(date,value,imported='2026-11-01',metric='followers')=>({snapshot_date:date,metric_value:value,imported_at:imported,metric_name:metric});
const result=spotifyEvolutionCharts([row('2026-10-01',null),row('2026-09-01',''),row('2026-08-01',0),row('2026-07-01',3,'2026-11-01'),row('2026-07-01',4,'2026-11-02'),row('2026-07-01',2,'2026-10-01')]);
assert.equal(result.length,4);
assert.deepEqual(result[0].points,[{date:'2026-07-01',value:4},{date:'2026-08-01',value:0}]);
assert.deepEqual(result[1].points,[]);
const component=await readFile(new URL('../app/components/spotify-evolution.tsx',import.meta.url),'utf8');
assert.match(component,/\.eq\("workspace_id", workspaceId\)/);
assert.match(component,/\.eq\("source", "spotify-audience-csv"\)/);
assert.match(component,/\.range\(offset, offset \+ pageSize - 1\)/);
const renderer=await readFile(new URL("../app/components/evolution-panel.tsx",import.meta.url),"utf8");
assert.match(renderer,/ArrowLeft.*ArrowRight.*Home.*End.*Escape/);
console.log('Spotify Evolution range, growth, missing-data, source and interaction checks passed.');

// Run the actual history-loading effect against a paginated, scoped reader.
const {stripTypeScriptTypes}=await import('node:module');
const effect=component.slice(component.indexOf('  useEffect(() => {'),component.indexOf('  const currentHistory'));
const ranges=[];
const filters=[];
const rows=Array.from({length:1103},(_,index)=>row('2026-10-01',index));
let fail=false;
const query={
 select(){return this;},eq(key,value){filters.push([key,value]);return this;},in(){return this;},order(){return this;},
 async range(start,end){ranges.push([start,end]);return fail?{error:new Error('read failed'),data:null}:{error:null,data:rows.slice(start,end+1)};}
};
const execute=new Function('useEffect','createBrowserSupabaseClient','workspaceId','refreshKey','setHistory',stripTypeScriptTypes(effect));
const loaded=await new Promise(resolve=>execute(callback=>callback(),()=>({from:()=>query}),'workspace-a',[],resolve));
assert.equal(loaded.rows.length,1103);
assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]],'All history must survive the generic Supabase row cap');
assert.equal(loaded.workspaceId,'workspace-a');
assert.ok(filters.some(([key,value])=>key==='workspace_id'&&value==='workspace-a'));
fail=true;
const failed=await new Promise(resolve=>execute(callback=>callback(),()=>({from:()=>query}),'workspace-b',[],resolve));
assert.equal(failed.state,'error');assert.deepEqual(failed.rows,[],'Do not silently display partial history');
console.log('Spotify Evolution paginated reader and error handling checks passed.');

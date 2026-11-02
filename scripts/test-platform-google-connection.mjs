import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
const start=source.indexOf('function getPlatformCardsForPreferences(');
const code=source.slice(start,source.indexOf('function getActivePlatformStats(',start));
const stats=[{slug:'youtube',platform:'YouTube Channel',metrics:[],profileUrl:''},{slug:'google-analytics',platform:'Website',metrics:[],profileUrl:''}];
const getCards=new Function('platformStats','platformChildSlugs',`${stripTypeScriptTypes(code)}; return getPlatformCardsForPreferences;`)(stats,{'platforms.youtube':'youtube','platforms.website':'google-analytics'});
const preferences={childOrderByParent:{platforms:['platforms.youtube','platforms.website']},visibleCards:['platforms.youtube','platforms.website']};
for(const dashboardOnly of [true,false]){
 for(const hasMetrics of [true,false]){
  for(const enabled of [true,false]){
   const connection={youtube:{enabled,channelId:'configured-channel'},analytics:{enabled},youtubeTopic:{enabled:false}};
   const cards=getCards(hasMetrics?stats:[],[],preferences,dashboardOnly,connection);
   assert.equal(cards.length,2);
   for(const card of cards){assert.equal(card.isDisconnected,!enabled);assert.equal(card.isConnectedWithoutMetrics,enabled&&!hasMetrics);}
   assert.equal(cards[0].profileUrl,'https://www.youtube.com/channel/configured-channel');
  }
 }
 const cards=getCards(stats,[],preferences,dashboardOnly,null);
 assert.ok(cards.every(c=>c.isDisconnected));
}
const platformsCall=source.slice(source.indexOf('<PlatformsView'),source.indexOf('/>',source.indexOf('<PlatformsView')));
assert.match(platformsCall,/googleConnection=\{workspaceGoogleConnection\}/);
const view=source.slice(source.indexOf('function PlatformsView({'),source.indexOf('\nfunction ',source.indexOf('function PlatformsView({')+10));
assert.match(view,/false,\s*googleConnection\s*\)/,'Platforms must pass live connection state to shared card builder');
console.log('Platforms Google connection checks passed.');

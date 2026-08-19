import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");

assert.match(component, /type CreatorThreadsState/);
assert.match(component, /loadCreatorThreads/);
assert.match(component, /fetch\("\/api\/integrations\/meta\/threads", \{ cache: "no-store" \}\)/);
assert.match(component, /<ThreadsRow/);
assert.match(component, /function ThreadsRow/);
assert.match(component, /<strong>Threads<\/strong>/);
assert.match(component, /Connect Threads/);
assert.match(component, /Reconnect Threads/);
assert.match(component, /Disconnect Threads/);
assert.match(component, /Needs reconnection/);
assert.match(component, /View Threads profile/);
assert.match(component, /\/api\/integrations\/meta\/threads\/connect\?return=\/\?settings=general/);
assert.match(component, /fetch\("\/api\/integrations\/meta\/threads", \{ method: "DELETE" \}\)/);
assert.match(component, /await loadCreatorThreads\(\)/);
assert.match(component, /Connects this workspace’s Threads account independently from Instagram\./);
assert.match(component, /<StandaloneInstagramRow[\s\S]*?<ThreadsRow/, "Threads is a peer of, not nested under, Standalone Instagram");
assert.match(component, /state=\{creatorThreads\}/, "Threads row receives only its authoritative Threads state");
assert.match(component, /Instagram via Facebook Page|<strong>Instagram<\/strong>/, "App B Instagram UI remains present");

console.log("Meta creator Threads settings UI tests passed.");

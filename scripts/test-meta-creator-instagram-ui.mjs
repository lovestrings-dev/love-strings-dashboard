import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");
const continuation = await readFile(new URL("../lib/meta/creator-instagram-continuation.ts", import.meta.url), "utf8");
assert.match(component, /Standalone Instagram/);
assert.match(component, /Connect standalone Instagram/);
assert.match(component, /Reconnect Instagram/);
assert.match(component, /Disconnect Instagram/);
assert.match(component, /This Instagram account is already connected through your Facebook Page\./);
assert.match(component, /\/api\/integrations\/meta\/instagram\/connect\?return=\/\?settings=general/);
assert.match(component, /fetch\("\/api\/integrations\/meta\/instagram", \{ method: "DELETE" \}\)/);
assert.match(component, /await loadCreatorInstagram\(\)/);
assert.match(component, /cleanCreatorInstagramContinuation/);
assert.match(continuation, /creator-social-instagram-/);
assert.match(continuation, /searchParams\.delete\("oauth"\)/);
assert.match(component, /Instagram via Facebook Page|<strong>Instagram<\/strong>/, "App B Instagram UI remains present");
console.log("Meta creator Instagram settings UI tests passed.");

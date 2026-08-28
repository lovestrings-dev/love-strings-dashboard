import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, view] = await Promise.all([
  readFile(new URL("../app/api/platform/workspaces/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/platform-administration-view.tsx", import.meta.url), "utf8")
]);

assert.match(route, /app_google_connections.*youtube_topic_channel_id.*analytics_enabled.*analytics_property_id/);
assert.match(route, /YouTube Channel/);
assert.match(route, /YouTube Topic/);
assert.match(route, /Google Analytics/);
assert.match(route, /fstats_login_facebook_page/);
assert.match(route, /creator_social_instagram/);
assert.match(route, /creator_social_threads/);
assert.match(route, /import_logs.*spotify-audience-csv.*spotify-songs-csv.*spotify-playlists-csv.*apple-music-csv/);
assert.match(route, /marketing_campaigns.*campaign_kind/);
assert.match(route, /focus_other_tasks.*stable_key/);
assert.match(route, /starterTaskModification: "Not tracked"/);
assert.match(route, /guidance_eligible_at/);

assert.match(view, /Workspace onboarding outcomes/);
assert.match(view, /Admin \/ workspace/);
assert.match(view, /Spotify CSV/);
assert.match(view, /Apple Music CSV/);
assert.match(view, /Starter-task modification is intentionally not inferred/);
assert.match(view, /Not applicable — this legacy workspace was never Guidance-eligible/);

console.log("Platform Administration onboarding outcome matrix checks passed.");

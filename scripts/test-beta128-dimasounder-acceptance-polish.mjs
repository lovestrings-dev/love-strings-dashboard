import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, collectors, postConnection, googleCallback, analyticsRoute, topicRoute, instagramCallback, threadsCallback, metaSelection, migration] = await Promise.all([
  read("app/page.tsx"),
  read("lib/metrics/collectors.ts"),
  read("lib/metrics/post-connection-collection.ts"),
  read("app/api/integrations/google/callback/route.ts"),
  read("app/api/integrations/google/analytics/route.ts"),
  read("app/api/integrations/youtube-topic/route.ts"),
  read("app/api/integrations/meta/instagram/callback/route.ts"),
  read("app/api/integrations/meta/threads/callback/route.ts"),
  read("app/api/integrations/meta/fstats-login/selection/route.ts"),
  read("supabase/migrations/202608280006_update_fresh_dashboard_statistics_defaults.sql")
]);

assert.match(page, /className="roadmap-settings-link production-released-songs-toggle"/, "Released-song visibility uses the lightweight link interaction.");
assert.match(page, /aria-expanded=\{showReleasedSongs\}/, "Released songs retains accessible expand/collapse state.");
assert.match(page, /const \[isDashboardOpen, setIsDashboardOpen\] = useState\(true\)/, "Personal View opens on normal User Settings entry.");
assert.match(page, /<span>Plan progress<\/span>[\s\S]*?<RoadmapReleaseStrip/, "Auto Plan progress remains song-based.");
assert.match(page, /12-month Roadmap/, "The separate Auto Plan time horizon remains labelled.");
assert.match(page, /Promise\.all\(\[[\s\S]*refreshGoogleConnection\(\)[\s\S]*refreshGuidanceStatus\(\)[\s\S]*loadPlatformStats\(\)/, "Guided Google waits for connection, Guidance, and metrics refresh before its cue.");
assert.match(page, /setTimeout\(\(\) => setGuidanceYouTubeCardHint\(false\), 1400\)/, "The YouTube cue expires as transient UI state.");
assert.match(page, /guidanceYouTubeCardHint && \(settingsView \|\| activeSection !== "Platforms"\)/, "Navigation clears a stale YouTube cue.");
assert.match(page, /googleServiceListRef/, "Guidance waits for the Google Services child content to mount before focus.");

assert.match(collectors, /export async function refreshMetricCollectors/, "Collectors support targeted post-connection collection.");
assert.match(collectors, /workspaceCollectionRuns/, "Concurrent workspace collection calls are serialized.");
assert.match(postConnection, /Initial platform collection did not complete/, "Initial collection failure preserves the connection path.");
for (const [source, collector] of [[googleCallback, "youtube"], [analyticsRoute, "google-analytics"], [topicRoute, "youtube-music"], [instagramCallback, "standalone-instagram"], [threadsCallback, "threads"], [metaSelection, "facebook"], [metaSelection, "instagram"]]) {
  assert.match(source, new RegExp(`collectAfterConnection\\([^\\n]+\\["${collector}"\\]`), `Connection path collects ${collector} once after binding.`);
}

assert.match(migration, /active_template\.version <> 5/, "Fresh-default migration is fail-closed.");
assert.match(migration, /'new-member-dashboard',\s*6/, "Fresh-default migration creates a new template version.");
for (const card of ["platforms.audience", "platforms.youtube", "platforms.instagram-creator"]) {
  assert.match(migration, new RegExp(card.replace(".", "\\.")), `${card} is enabled for new Dashboard snapshots.`);
}
for (const card of ["platforms.spotify", "platforms.apple-music", "platforms.youtube-topic"]) {
  assert.doesNotMatch(migration, new RegExp(card.replace(".", "\\.")), `${card} is not enabled by the new fresh default.`);
}

console.log("Beta 1.28 known-user acceptance polish contracts passed.");

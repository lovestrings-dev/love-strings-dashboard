import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8")
]);

assert.match(page, /const activeSongs = sortedSongs\.filter\([\s\S]*getProductionCompletionScore\(song\) < 100 && !isRoadmapSongReleased\(song\)/);
assert.match(page, /const \[current, next\] = activeSongs;/);
assert.match(styles, /dashboard-production-card:not\(\.dashboard-production-card-compact\) \.dashboard-production-card-header \{[\s\S]*grid-template-columns: 84px minmax\(0, 1fr\) 112px;/);
assert.match(styles, /\.dashboard-production-card \.dashboard-campaign-date \{[\s\S]*height: 84px;[\s\S]*min-height: 84px;/);
assert.match(styles, /\.dashboard-production-card \.dashboard-campaign-date span \{[\s\S]*white-space: nowrap;/);
assert.match(styles, /dashboard-production-card:not\(\.dashboard-production-card-compact\) \.dashboard-production-art \{[\s\S]*height: 84px;[\s\S]*width: 84px;/);

console.log("Dashboard production preview checks passed.");

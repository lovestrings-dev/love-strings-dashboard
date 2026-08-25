import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8")
]);

const manualCard = page.slice(page.indexOf("function ManualRoadmapPlanCard"), page.indexOf("function addCalendarMonth"));
const membershipRoute = await readFile(new URL("../app/api/roadmap/plans/route.ts", import.meta.url), "utf8");

assert.match(manualCard, /const addSong = async \(\) =>/);
assert.match(manualCard, /await onPlanMutation\("PUT", \{ action: "add", id: plan\.id, songId: selectedSongId \}\)/);
assert.match(manualCard, /setSelectedSongId\(""\);/);
assert.match(manualCard, /disabled=\{!selectedSongId \|\| isAdding\}/);
assert.match(styles, /\.roadmap-manual-picker \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
assert.match(membershipRoute, /mutate_manual_roadmap_plan_membership/);
assert.match(membershipRoute, /p_action: body\.action/);

console.log("Manual Roadmap Add hotfix checks passed.");

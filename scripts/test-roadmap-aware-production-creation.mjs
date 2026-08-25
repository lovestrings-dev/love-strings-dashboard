import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, route, page] = await Promise.all([
  readFile(new URL("../supabase/migrations/202608250007_create_roadmap_aware_production_v1_song.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/production/songs/create-roadmap-aware/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8")
]);

assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_workspace_id::text, 0\)\)/);
assert.match(migration, /roadmap_standard_release_cadence_days/);
assert.match(migration, /now\(\) at time zone coalesce\(settings\.timezone, 'Europe\/Vienna'\)/);
assert.match(migration, /max\(song\.release_date\)/);
assert.match(migration, /coalesce\(max\(song\.roadmap_general_position\), 0\) \+ 1/);
assert.match(migration, /greatest\(v_workspace_today, coalesce\(v_latest_release_date, v_workspace_today\)\) \+ v_cadence_days/);
assert.match(migration, /roadmap_general_position/);
assert.match(migration, /production_template_snapshot/);
assert.match(migration, /'not-started'/);
assert.match(migration, /v_release_date - v_step\.lead_time_days/);
assert.match(route, /requireWorkspaceAccess/);
assert.match(route, /create_roadmap_aware_production_v1_song/);
assert.match(page, /createRoadmapAwareProductionSong/);
assert.doesNotMatch(page, /function getNextProductionSongDeadline/);
assert.doesNotMatch(page, /const newDeadline = getNextProductionSongDeadline/);

console.log("Roadmap-aware Production creation checks passed.");

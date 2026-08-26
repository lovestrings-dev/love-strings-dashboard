import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, route, planRoute, page] = await Promise.all([
  readFile(new URL("../supabase/migrations/202608260003_add_first_song_bootstrap.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/production/songs/create-roadmap-aware/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/roadmap/plans/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8")
]);

assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_workspace_id::text, 0\)\)/);
assert.match(migration, /roadmap_standard_release_cadence_days/);
assert.match(migration, /now\(\) at time zone coalesce\(settings\.timezone, 'Europe\/Vienna'\)/);
assert.match(migration, /count\(\*\) = 0/);
assert.match(migration, /coalesce\(nullif\(btrim\(p_title\), ''\), 'My Song Name'\)/);
assert.match(migration, /v_workspace_today \+ v_production_window \+ v_distributor_lead_time/);
assert.match(migration, /insert into public\.roadmap_phases/i);
assert.match(migration, /'My Album Name'/);
assert.match(migration, /date_trunc\('month', v_workspace_today\)::date/);
assert.match(migration, /v_plan_start \+ interval '11 months'/);
assert.match(migration, /max\(song\.release_date\)/);
assert.match(migration, /coalesce\(max\(song\.roadmap_general_position\), 0\) \+ 1/);
assert.match(migration, /greatest\(v_workspace_today, v_latest_release_date\) \+ v_cadence_days/);
assert.match(migration, /roadmap_general_position/);
assert.match(migration, /production_template_snapshot/);
assert.match(migration, /'not-started'/);
assert.match(migration, /v_release_date - v_step\.lead_time_days/);
assert.match(route, /requireWorkspaceAccess/);
assert.match(route, /create_roadmap_aware_production_v1_song/);
assert.match(route, /p_title: typeof title === "string" \? title\.trim\(\) : ""/);
assert.match(planRoute, /planType === "auto" \? "My Album Name" : ""/);
assert.match(planRoute, /planType === "auto" && suppliedStart \? `\$\{suppliedStart\.slice\(0, 7\)\}-01` : suppliedStart/);
assert.match(page, /createRoadmapAwareProductionSong/);
assert.match(page, /createRoadmapAwareProductionSong\(\)/);
assert.match(page, /placeholder=\{planType === "auto" \? "My Album Name" : undefined\}/);
assert.doesNotMatch(page, /function getNextProductionSongDeadline/);
assert.doesNotMatch(page, /const newDeadline = getNextProductionSongDeadline/);

console.log("Roadmap-aware Production creation checks passed.");

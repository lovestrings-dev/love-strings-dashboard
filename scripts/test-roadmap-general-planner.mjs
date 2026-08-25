import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addRoadmapDays, moveRoadmapAutoPlanSong, moveRoadmapSong, replanFutureRoadmap } from "../lib/roadmap-general-planner.ts";

assert.equal(addRoadmapDays("2026-09-01", 7), "2026-09-08");
assert.equal(addRoadmapDays("2026-09-01", 14), "2026-09-15");
assert.equal(addRoadmapDays("2026-09-01", 21), "2026-09-22");
assert.equal(addRoadmapDays("2026-09-01", 28), "2026-09-29");

const songs = [
  { id: "history", position: 1, releaseDate: "2026-08-01" },
  { id: "a", position: 2, releaseDate: "2026-09-01" },
  { id: "b", position: 3, releaseDate: "2026-10-01" },
  { id: "c", position: 4, releaseDate: "2026-10-31" }
];

const anchored = replanFutureRoadmap({ songs: songs.map((song) => song.id === "b" ? { ...song, releaseDate: "2026-10-10" } : song), cadenceDays: 30, anchorPosition: 3 });
assert.deepEqual(anchored.map((song) => song.releaseDate), ["2026-08-01", "2026-09-01", "2026-10-10", "2026-11-09"]);

const movedDown = moveRoadmapSong({ songs, songId: "a", direction: 1, today: "2026-08-25", cadenceDays: 30 });
assert.deepEqual(movedDown.map((song) => song.id), ["history", "b", "a", "c"]);
assert.deepEqual(movedDown.map((song) => song.releaseDate), ["2026-08-01", "2026-09-01", "2026-10-01", "2026-10-31"]);

const movedUp = moveRoadmapSong({ songs, songId: "c", direction: -1, today: "2026-08-25", cadenceDays: 30 });
assert.deepEqual(movedUp.map((song) => song.id), ["history", "a", "c", "b"]);
assert.deepEqual(movedUp.map((song) => song.releaseDate), ["2026-08-01", "2026-09-01", "2026-10-01", "2026-10-31"]);

const irregularSlots = [
  { id: "a", position: 1, releaseDate: "2026-09-01" },
  { id: "b", position: 2, releaseDate: "2026-09-29" },
  { id: "c", position: 3, releaseDate: "2026-10-13" },
  { id: "d", position: 4, releaseDate: "2026-11-15" },
  { id: "e", position: 5, releaseDate: "2026-11-29" }
];
const movedAcrossSlots = moveRoadmapSong({ songs: irregularSlots, songId: "b", direction: 1, today: "2026-08-25", cadenceDays: 14 });
const movedAcrossSlotsTwice = moveRoadmapSong({ songs: movedAcrossSlots, songId: "b", direction: 1, today: "2026-08-25", cadenceDays: 14 });
assert.deepEqual(movedAcrossSlotsTwice.map((song) => song.id), ["a", "c", "d", "b", "e"]);
assert.deepEqual(movedAcrossSlotsTwice.map((song) => song.releaseDate), ["2026-09-01", "2026-09-29", "2026-10-13", "2026-11-15", "2026-11-29"]);

const manualAnchor = replanFutureRoadmap({ songs: irregularSlots.map((song) => song.id === "b" ? { ...song, releaseDate: "2026-09-29" } : song), cadenceDays: 14, anchorPosition: 2, today: "2026-08-25" });
assert.deepEqual(manualAnchor.map((song) => song.releaseDate), ["2026-09-01", "2026-09-29", "2026-10-13", "2026-10-27", "2026-11-10"]);
const normalized = replanFutureRoadmap({ songs: manualAnchor, cadenceDays: 14, anchorPosition: 1, today: "2026-08-25" });
assert.deepEqual(normalized.map((song) => song.releaseDate), ["2026-09-01", "2026-09-15", "2026-09-29", "2026-10-13", "2026-10-27"]);

assert.throws(() => moveRoadmapSong({ songs, songId: "history", direction: 1, today: "2026-08-25", cadenceDays: 30 }));
const autoPlanSongs = [
  { id: "a", position: 1, releaseDate: "2026-09-01", autoPlanId: "p1" },
  { id: "b", position: 2, releaseDate: "2026-09-15", autoPlanId: "p2" },
  { id: "c", position: 3, releaseDate: "2026-09-29", autoPlanId: "p1" },
  { id: "d", position: 4, releaseDate: "2026-10-13", autoPlanId: null },
  { id: "e", position: 5, releaseDate: "2026-10-27", autoPlanId: "p2" }
];
const autoMoved = moveRoadmapAutoPlanSong({ songs: autoPlanSongs, songId: "c", autoPlanId: "p1", direction: -1, today: "2026-08-25" });
assert.deepEqual(autoMoved.map((song) => song.id), ["c", "b", "a", "d", "e"]);
assert.deepEqual(autoMoved.map((song) => song.releaseDate), ["2026-09-01", "2026-09-15", "2026-09-29", "2026-10-13", "2026-10-27"]);
assert.equal(autoMoved[1].id, "b", "cross-plan slot must remain untouched");
assert.equal(autoMoved[3].id, "d", "unassigned slot must remain untouched");
assert.throws(() => moveRoadmapAutoPlanSong({ songs: autoPlanSongs, songId: "a", autoPlanId: "p1", direction: -1, today: "2026-08-25" }));
const mutation = await readFile(new URL("../supabase/migrations/202608250002_add_roadmap_general_planner_mutation.sql", import.meta.url), "utf8");
const ambiguityFix = await readFile(new URL("../supabase/migrations/202608250003_fix_roadmap_general_planner_position_ambiguity.sql", import.meta.url), "utf8");
const idAmbiguityFix = await readFile(new URL("../supabase/migrations/202608250006_fix_roadmap_general_planner_id_ambiguity.sql", import.meta.url), "utf8");
const roadmapUi = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const roadmapStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const autoMembership = await readFile(new URL("../supabase/migrations/202608250009_enforce_one_auto_plan_membership.sql", import.meta.url), "utf8");
assert.match(mutation, /create or replace function public\.apply_roadmap_general_plan/i);
assert.match(mutation, /save_production_v1_song_with_derived_custom_timing/i);
assert.match(mutation, /roadmap_general_position = song\.roadmap_general_position \+ 1000000/i);
assert.match(mutation, /update public\.marketing_campaigns/i);
assert.match(ambiguityFix, /roadmap_general_position = song\.roadmap_general_position \+ 1000000/i);
assert.match(idAmbiguityFix, /select song_row\.scheduling_model into song_model from public\.production_songs song_row where song_row\.id = song_id for update/i);
assert.match(idAmbiguityFix, /update public\.production_songs song_row set roadmap_general_position/i);
assert.match(idAmbiguityFix, /return query select song_row\.id, song_row\.release_date, song_row\.roadmap_general_position/i);
assert.match(roadmapUi, /generalPlanner \|\| autoPlanId/);
assert.match(roadmapUi, /cadenceLoaded/);
assert.match(roadmapUi, /roadmap-cadence-control/);
assert.match(roadmapUi, /outside plan timeframe/);
assert.match(roadmapUi, /type: "auto-move"/);
assert.match(autoMembership, /A Production song may belong to only one Auto plan/);
assert.match(autoMembership, /instance\.plan_type = 'auto'/);
assert.match(roadmapStyles, /\.roadmap-cadence-control\s*\{[\s\S]*grid-template-columns: minmax\(230px, 1fr\) minmax\(110px, 150px\) auto/);
assert.match(roadmapStyles, /\.roadmap-cadence-control\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
console.log("Roadmap General Planner calculations passed.");

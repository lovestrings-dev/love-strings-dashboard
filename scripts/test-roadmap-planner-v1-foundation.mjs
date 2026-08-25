import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/202608250001_create_roadmap_planner_v1_foundation.sql", import.meta.url),
  "utf8"
);

assert.match(migration, /roadmap_standard_release_cadence_days integer not null default 30/i);
assert.match(migration, /check \(roadmap_standard_release_cadence_days > 0\)/i);
assert.match(migration, /roadmap_general_position integer/i);
assert.match(migration, /partition by workspace_id\s+order by release_date asc, created_at asc, id asc/is);
assert.match(migration, /unique \(workspace_id, roadmap_general_position\)/i);
assert.match(migration, /create table public\.roadmap_planning_instances/i);
assert.match(migration, /check \(plan_type in \('auto', 'manual'\)\)/i);
assert.match(migration, /Roadmap planning instance type is immutable/i);
assert.match(migration, /create table public\.roadmap_planning_instance_songs/i);
assert.match(migration, /foreign key \(planning_instance_id, workspace_id\)/i);
assert.match(migration, /foreign key \(production_song_id, workspace_id\)/i);
assert.match(migration, /Auto planning instances use General Roadmap ordering/i);
assert.match(migration, /max\(local_position\), 0\) \+ 1/i);
assert.match(migration, /sync_legacy_roadmap_phase_planning_instance/i);
assert.match(migration, /sync_legacy_song_roadmap_phase_membership/i);
assert.match(migration, /Workspace members can read roadmap planning instances/i);
assert.match(migration, /Workspace members can read roadmap planning instance songs/i);
assert.doesNotMatch(migration, /update public\.production_songs\s+set release_date/i);
assert.doesNotMatch(migration, /update public\.marketing_campaigns/i);

console.log("Roadmap Planner V1 backend foundation migration checks passed.");

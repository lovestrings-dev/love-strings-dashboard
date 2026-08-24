import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, migration, derivedTimingMigration] = await Promise.all([
  readFile(new URL("../app/api/production/songs/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608240006_save_production_v1_song_atomically.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608240012_add_derived_custom_step_timing.sql", import.meta.url), "utf8")
]);

assert.match(route, /song\.schedulingModel === "template-v1"/);
assert.match(route, /saveProductionV1SongAtomically\(song, workspaceId\)/);
assert.match(route, /\.rpc\("save_production_v1_song_with_derived_custom_timing"/);

assert.match(migration, /create or replace function public\.save_production_v1_song_atomically/);
assert.match(migration, /for update;/);
assert.match(migration, /where production_step\.production_song_id = v_song_id\s+and production_step\.stable_key = v_step ->> 'id'/);
assert.match(migration, /update public\.production_steps/);
assert.match(migration, /insert into public\.production_steps/);
assert.match(migration, /where task\.id = case when/);
assert.match(migration, /update public\.production_step_tasks/);
assert.match(migration, /where budget_line\.id = case when/);
assert.match(migration, /update public\.production_budget_lines/);
assert.match(migration, /and production_step\.id <> all\(v_seen_step_ids\)/);
assert.match(migration, /production_template_snapshot = p_song -> 'productionTemplateSnapshot'/);
assert.match(migration, /coalesce\(p_song ->> 'schedulingModel', ''\) <> 'template-v1'/);
assert.match(migration, /grant execute on function public\.save_production_v1_song_atomically\(uuid, jsonb\) to service_role/);

const legacyDeleteInsertPath = route.indexOf('const { error: deleteStepsError }');
const v1Branch = route.indexOf('return saveProductionV1SongAtomically(song, workspaceId);');
assert.ok(v1Branch >= 0 && legacyDeleteInsertPath > v1Branch, "V1 exits before the legacy delete/reinsert path.");
assert.match(derivedTimingMigration, /greatest\(0, \(coalesce\(next_step\.step_deadline, song\.release_date\) - custom_step\.step_deadline\)\)::integer/);
assert.match(derivedTimingMigration, /'\{timingMode\}', '"derived"'::jsonb/);
assert.match(derivedTimingMigration, /template_step_id is null/);

console.log("Production V1 identity-preserving save regression checks passed.");

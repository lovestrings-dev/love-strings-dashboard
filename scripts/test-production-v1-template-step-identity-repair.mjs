import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202608250005_repair_bioglycerin_v1_template_step_identities.sql", import.meta.url), "utf8");

assert.match(migration, /Against The Wall V1 identity repair expected exactly 8 missing standard identities/i);
assert.match(migration, /Against The Wall V1 identity repair found an ambiguous snapshot match/i);
assert.match(migration, /template_step_id = \(snapshot_step ->> 'id'\)::uuid/);
assert.match(migration, /template_step_standard_cost_amount/);
assert.match(migration, /v_updated_count <> 8/);
assert.doesNotMatch(migration, /delete from public\.production_steps/i);
assert.doesNotMatch(migration, /update public\.production_songs\s+set release_date/i);

console.log("Production V1 template-step identity repair migration checks passed.");

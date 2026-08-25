import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202608250004_normalize_v1_legacy_demo_anchors.sql", import.meta.url), "utf8");

assert.match(migration, /legacy Demo remnants on V1 songs/i);
assert.match(migration, /step\.stable_key ~\* '\^demo-'/);
assert.match(migration, /step_deadline = date '2025-12-15'/);
assert.match(migration, /BIOGLYCERIN legacy Demo repair expected 3 rows/);
assert.match(migration, /Love Strings legacy Demo repair expected 21 rows/);
assert.match(migration, /template_step_kind = idea\.snapshot_step ->> 'stepKind'/);
assert.doesNotMatch(migration, /delete from public\.production_steps/i);

console.log("Production V1 legacy Demo cleanup migration checks passed.");

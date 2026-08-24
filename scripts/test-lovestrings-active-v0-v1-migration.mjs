import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, completionMigration] = await Promise.all([
  readFile(new URL("../supabase/migrations/202608240010_migrate_lovestrings_template_compatible_active_songs_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608240011_complete_lovestrings_active_v1_custom_steps.sql", import.meta.url), "utf8")
]);
assert.match(migration, /v_target_song_ids constant uuid\[\].*82697ad0/s);
assert.match(migration, /scheduling_model = 'template-v1'/);
assert.match(migration, /when 'demo' then 'anchor-idea-v1'/);
assert.match(migration, /when 'distributor' then 'distributor-v1'/);
assert.match(migration, /production_template_snapshot = v_snapshot/);
assert.match(migration, /lower\(label\) not in \('demo', 'drums', 'guitars', 'bass', 'vocals', 'mix', 'master', 'license', 'cover art', 'distributor'\)/);
assert.doesNotMatch(migration, /delete from public\.production_steps/i);
assert.match(completionMigration, /lower\(edit_step\.label\) = 'edit'/);
assert.match(completionMigration, /An obsolete Love Strings Edit row contains unique or child data/);
assert.match(completionMigration, /delete from public\.production_steps/);
assert.match(completionMigration, /stable_key = 'custom-' \|\| step\.id::text/);
assert.match(completionMigration, /'timingMode', 'fixed'/);
assert.match(completionMigration, /position = 550/);
console.log("Love Strings active V0-to-V1 migration checks passed.");

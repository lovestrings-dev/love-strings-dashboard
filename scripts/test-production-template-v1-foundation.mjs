import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, deleteTriggerFix] = await Promise.all([
  readFile(new URL("../supabase/migrations/202608240001_create_workspace_production_templates_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608240002_fix_production_template_step_delete_trigger.sql", import.meta.url), "utf8")
]);

assert.match(migration, /create table public\.production_templates/i);
assert.match(migration, /create table public\.production_template_steps/i);
assert.match(migration, /stable_key text not null/i);
assert.match(migration, /step_kind text not null/i);
assert.match(migration, /semantic_kind text not null default 'standard'/i);
assert.match(migration, /semantic_kind = 'distribution'/i);
assert.match(migration, /anchor-idea-v1.*'Idea'/i);
assert.match(migration, /anchor-release-v1.*'Release'/i);
assert.match(migration, /production_template_steps_protect_anchors/i);
assert.match(migration, /scheduling_model text not null default 'legacy-v0'/i);
assert.match(migration, /production_template_snapshot jsonb/i);
assert.match(migration, /template_step_stable_key text/i);
assert.match(migration, /template_step_lead_time_days integer/i);
assert.match(migration, /create_workspace_production_template_v1/i);
assert.match(migration, /app_workspace_settings_seed_production_template_v1/i);
assert.match(migration, /Workspace members can read production templates/i);
assert.match(migration, /Workspace members can read production template steps/i);

assert.doesNotMatch(migration, /update public\.production_songs/i);
assert.doesNotMatch(migration, /update public\.production_steps/i);
assert.doesNotMatch(migration, /delete from public\.production_songs/i);
assert.doesNotMatch(migration, /delete from public\.production_steps/i);
assert.match(deleteTriggerFix, /if tg_op = 'DELETE' then/i);
assert.match(deleteTriggerFix, /return old;/i);

console.log("Production Template V1 migration foundation checks passed.");

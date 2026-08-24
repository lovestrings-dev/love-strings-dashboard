import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [settings, page, route, migration] = await Promise.all([
  readFile(new URL("../app/production-workflow-settings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/workspace/production-template/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608240001_create_workspace_production_templates_v1.sql", import.meta.url), "utf8")
]);

assert.match(settings, /const addOptions = \["Arrangement", "Backing Vocals", "Brass", "Editing", "Keyboard", "Metadata", "Percussion", "Programming", "Sound Design", "Strings", "Synths", "Blank Step"\]/);
assert.match(settings, /Standard production window:/);
assert.match(settings, /semanticKind === "distribution"/);
assert.match(settings, /crypto\.randomUUID\(\)/);
assert.match(settings, /disabled=\{!canMoveUp\}/);
assert.match(settings, /disabled=\{!canMoveDown\}/);
assert.match(settings, /disabled=\{!isNormal \|\| !editing\}/);
assert.match(settings, /disabled=\{isNormal && !editing\}/);
assert.match(settings, /onBlur=\{isDistributor \? saveDraft : undefined\}/);
assert.match(page, /<ProductionWorkflowSettings \/>/);
assert.doesNotMatch(page, /title="Default step costs"/);
assert.match(page, /createProductionSongFromV1Template/);
assert.match(page, /instantiateProductionV1Song/);
assert.match(page, /sortProductionStepsForSong/);
assert.match(page, /mergedSong\.schedulingModel === "template-v1"/);
assert.match(page, /const budgetTotal = budgetLines\.reduce\(/);
assert.match(page, /budgetTotal !== 0/);
assert.match(page, /production-step-budget-total/);
assert.match(route, /requireWorkspaceAdministrator/);
assert.match(route, /Distributor must remain directly before Release/);
assert.match(route, /Production template requires one Idea, one Distributor, and one Release row/);
assert.match(migration, /'drums-v1'.*true, 2, 0/);
assert.match(migration, /'guitars-v1'.*true, 2, 0/);
assert.match(migration, /'bass-v1'.*true, 2, 0/);
assert.match(migration, /'vocals-v1'.*true, 3, 0/);
assert.match(migration, /'mix-v1'.*true, 7, 0/);
assert.match(migration, /'master-v1'.*true, 3, 0/);
assert.match(migration, /'license-v1'.*true, 3, v_license_cost/);
assert.match(migration, /'cover-art-v1'.*true, 3, 0/);
assert.match(migration, /'distributor-v1'.*true, 14, v_distributor_cost/);

console.log("Production workflow settings and V1 activation checks passed.");

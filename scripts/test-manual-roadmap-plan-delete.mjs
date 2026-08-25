import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/roadmap/plans/route.ts", import.meta.url), "utf8");
const roadmapUi = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const foundationMigration = await readFile(
  new URL("../supabase/migrations/202608250001_create_roadmap_planner_v1_foundation.sql", import.meta.url),
  "utf8"
);

assert.match(route, /export async function DELETE\(request: NextRequest\)/);
assert.match(route, /role !== "admin"/);
assert.match(route, /Only a workspace Admin can delete Manual Collection Plans\./);
assert.match(route, /\.eq\("workspace_id", workspaceId\)\s*\.eq\("id", id\)\s*\.eq\("plan_type", "manual"\)/s);
assert.match(route, /Manual Collection Plan was not found\./);
assert.doesNotMatch(route.match(/export async function DELETE[\s\S]*?(?=async function load)/)?.[0] ?? "", /roadmap_phases/);

assert.match(roadmapUi, /onDelete=\{\(\) => onPlanMutation\("DELETE", \{ id: plan\.id \}\)\}/);
assert.match(roadmapUi, /if \(!isDeleteArmed\) \{ setIsDeleteArmed\(true\); return; \}/);
assert.match(roadmapUi, /window\.addEventListener\("pointerdown", cancelDelete\)/);
assert.match(roadmapUi, /if \(!open\) return null;/);

assert.match(
  foundationMigration,
  /foreign key \(planning_instance_id, workspace_id\)[\s\S]*?references public\.roadmap_planning_instances \(id, workspace_id\)\s+on delete cascade/i
);

console.log("Manual Collection Plan delete route, guard, and cascade wiring checks passed.");

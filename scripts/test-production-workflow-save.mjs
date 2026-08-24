import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [settings, route] = await Promise.all([
  readFile(new URL("../app/production-workflow-settings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/workspace/production-template/route.ts", import.meta.url), "utf8")
]);

assert.match(settings, /setStatus\("Saving…"\)/);
assert.match(settings, /const saveWhenLeavingRow =/);
assert.match(settings, /onBlur=\{saveWhenLeavingRow\}/);
assert.match(settings, /disabled=\{isNormal && !editing\}/);
assert.match(settings, /isIdea \? <span className="production-workflow-hint-label">Time/);
assert.match(settings, /isRelease \? <span className="production-workflow-release-hint">/);
assert.match(settings, /<Pencil size=\{16\} \/>/);
assert.match(settings, /<Trash2 size=\{16\} \/>/);
assert.match(settings, /const \[addTime, setAddTime\] = useState\("1"\)/);
assert.match(settings, /production-workflow-hint-label">Time/);
assert.match(settings, /production-workflow-hint-label">Cost/);
assert.match(settings, /production-workflow-hint-label">Edit/);
assert.match(settings, /Distributor Step ON:/);
assert.match(settings, /Production deadline follows Distributor/);
assert.match(settings, /Same as Release: OFF/);
assert.match(settings, /production-workflow-add-action/);
assert.match(route, /const temporaryPositionBase = 1_000_000_000/);
assert.match(route, /update\(\{ position: temporaryPositionBase \+ index \}\)/);
assert.match(route, /positions\.has\(step\.position\)/);
assert.match(route, /const removedIds =/);
assert.match(route, /\.delete\(\)/);

console.log("Production workflow save regression checks passed.");

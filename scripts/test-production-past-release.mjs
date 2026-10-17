import assert from "node:assert/strict";
import { completeStepsForPastRelease } from "../lib/production-completion.ts";

const steps = [
  { id: "mix", status: "in-progress", deadline: "2026-10-10", extraTasks: [{ id: "revision", status: "not-started", title: "Revision" }] },
  { id: "master", status: "not-started", extraTasks: [], budgetLines: [{ amount: 30 }] }
];
const original = structuredClone(steps);
const completed = completeStepsForPastRelease(steps, "2026-10-16", "2026-10-17");
assert.ok(completed.every((step) => step.status === "done"));
assert.equal(completed[0].extraTasks[0].status, "done");
assert.equal(completed[0].extraTasks[0].title, "Revision");
assert.equal(completed[0].deadline, "2026-10-10");
assert.deepEqual(completed[1].budgetLines, [{ amount: 30 }]);
assert.deepEqual(steps, original);
for (const releaseDate of ["2026-10-17", "2026-10-18", null]) {
  assert.equal(completeStepsForPastRelease(steps, releaseDate, "2026-10-17"), steps);
}
assert.deepEqual(completeStepsForPastRelease([], "2026-10-16", "2026-10-17"), []);
console.log("Past-release Production completion checks passed.");

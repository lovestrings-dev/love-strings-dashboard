import assert from "node:assert/strict";
import { reconcileProductionV1Snapshot, createProductionV1SongPlanFromSnapshot, recalculateProductionV1Song } from "../lib/production-template-v1.ts";

const step = (id, position, semanticKind = "standard") => ({ id, position, stableKey: id, displayName: id, stepKind: "production_step", semanticKind, leadTimeDays: 7, standardCostAmount: 0 });
const snapshot = { schedulingModel: "template-v1", templateId: "template", templateVersion: 1, releaseAnchor: { ...step("release", 4), stepKind: "release_anchor" }, steps: [step("mix", 1), step("removed", 2), step("distribution", 3, "distribution")] };
const original = structuredClone(snapshot);
const live = [
  { id: "mix", label: "Mix", deadline: "2026-11-01", status: "done" },
  { id: "custom", label: "Manual revision", deadline: "2026-11-03", status: "in-progress" },
  { id: "distribution", label: "Distribution", deadline: "2026-11-13", status: "not-started" }
];
assert.throws(() => createProductionV1SongPlanFromSnapshot({ snapshot, liveSteps: live, releaseDate: "2026-11-20", productionDeadline: "2026-11-13" }), /absent/);
const reconciled = reconcileProductionV1Snapshot(snapshot, live);
assert.deepEqual(snapshot, original, "reconciliation never mutates the stored template");
assert.deepEqual(reconciled.steps.map(s => s.id), ["mix", "custom", "distribution"]);
assert.equal(reconciled.steps[1].timingMode, "fixed");
const plan = createProductionV1SongPlanFromSnapshot({ snapshot: reconciled, liveSteps: live, releaseDate: "2026-11-20", productionDeadline: "2026-11-13" });
const moved = recalculateProductionV1Song(plan, "2026-11-27");
assert.equal(moved.releaseDate, "2026-11-27");
assert.equal(moved.steps.find(s => s.id === "mix").deadline, "2026-11-01", "completed work stays fixed");
assert.equal(moved.steps.find(s => s.id === "custom").deadline, "2026-11-03", "manual custom date stays fixed");
assert.equal(moved.steps.find(s => s.id === "distribution").deadline, "2026-11-20", "pending template work follows release");
assert.deepEqual(moved.steps.map(s => s.status), live.map(s => s.status));
assert.deepEqual(reconcileProductionV1Snapshot(reconciled, live), reconciled, "reload/save reconciliation is idempotent");
assert.deepEqual(reconcileProductionV1Snapshot(snapshot, []).steps, []);
console.log("Production edited-workflow release scheduling regression checks passed.");

// Exercise the API save boundary, including canonical reconciliation passed to
// the atomic database writer, rather than only the scheduler helper.
const { readFile } = await import("node:fs/promises");
const { stripTypeScriptTypes } = await import("node:module");
const route = await readFile(new URL("../app/api/production/songs/route.ts", import.meta.url), "utf8");
const { normalizeProductionDateForPersistence, formatProductionDateForDisplay } = await import("../lib/production-date-format.ts");
let persisted;
const db = {
  from(table) {
    const result = table === "production_songs"
      ? { production_deadline: "2026-11-13", release_date: "2026-11-20", production_template_id: "template", production_template_version: 1, production_template_snapshot: snapshot }
      : live.map((s, i) => ({ stable_key: s.id, label: s.label, position: i + 1, step_deadline: s.deadline, status: s.status, template_step_id: s.id === "custom" ? null : s.id }));
    const query = { select() { return query; }, eq() { return query; }, order() { return query; }, single() { return query; }, then(resolve, reject) { return Promise.resolve({ data: result, error: null }).then(resolve, reject); } };
    return query;
  },
  async rpc(_name, args) { persisted = structuredClone(args.p_song); return { data: [{ id: "song", slug: "song" }], error: null }; }
};
globalThis.__productionSnapshotTest = { createProductionV1SongPlanFromSnapshot, reconcileProductionV1Snapshot, recalculateProductionV1Song, normalizeProductionDateForPersistence, formatProductionDateForDisplay, createServiceSupabaseClient: () => db };
const code = `const {createProductionV1SongPlanFromSnapshot,reconcileProductionV1Snapshot,recalculateProductionV1Song,normalizeProductionDateForPersistence,formatProductionDateForDisplay,createServiceSupabaseClient}=globalThis.__productionSnapshotTest;\n` + route.slice(route.indexOf("async function saveProductionV1SongAtomically"), route.indexOf("function isAuthorizedProductionRequest")) + `\nfunction createStableId(value) { return value; }\nexport { saveProductionV1SongAtomically };`;
const { saveProductionV1SongAtomically } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString("base64")}`);
const saved = await saveProductionV1SongAtomically({ id: "song", dbId: "song", title: "Edited workflow", releaseDate: "27/11/2026", deadline: "13/11/2026", productionTemplateId: "template", productionTemplateVersion: 1, productionTemplateSnapshot: snapshot, steps: live.map(s => ({ ...s, templateStepId: s.id === "custom" ? undefined : s.id, extraTasks: [] })) }, "source-workspace");
assert.equal(persisted.releaseDate, "2026-11-27");
assert.deepEqual(persisted.productionTemplateSnapshot.steps.map(s => s.id), ["mix", "custom", "distribution"]);
assert.deepEqual(saved.song.productionTemplateSnapshot, persisted.productionTemplateSnapshot);
assert.equal(persisted.steps.find(s => s.id === "custom").deadline, "2026-11-03");
assert.equal(persisted.steps.find(s => s.id === "distribution").deadline, "2026-11-20");
console.log("Production API persists and returns the reconciled schedule through its atomic save path.");

assert.equal(saved.song.deadline, "20/11/2026", "API returns display dates for browser state");
assert.equal(saved.song.releaseDate, "27/11/2026");
assert.equal(saved.song.steps.find(s => s.id === "mix").deadline, "01/11/2026");
assert.equal(saved.song.steps.find(s => s.id === "custom").deadline, "03/11/2026");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const browserSchedule = page.slice(page.indexOf("function applyProductionV1ReleaseSchedule("), page.indexOf("function getProductionDeadlineSortTime("));
const apply = new Function("createProductionV1SongPlanFromSnapshot", "reconcileProductionV1Snapshot", "recalculateProductionV1Song", "normalizeProductionDateForPersistence", "formatProductionDateForDisplay", "toIsoDate", "formatDateKeyForInput", "sortProductionStepsForSong", stripTypeScriptTypes(browserSchedule) + "; return applyProductionV1ReleaseSchedule;")(
  createProductionV1SongPlanFromSnapshot, reconcileProductionV1Snapshot, recalculateProductionV1Song,
  normalizeProductionDateForPersistence, formatProductionDateForDisplay,
  value => /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? normalizeProductionDateForPersistence(value) : null,
  formatProductionDateForDisplay, (_song, steps) => steps
);
// Reproduce the stale client state from the former API response: completed and
// custom deadlines remain ISO. DateInput parsing used to convert these to "".
const staleClientSong = { ...saved.song, schedulingModel: "template-v1", deadline: "2026-11-20", steps: saved.song.steps.map(s => ({ ...s, deadline: normalizeProductionDateForPersistence(s.deadline) })) };
for (const clientSong of [staleClientSong, { ...saved.song, schedulingModel: "template-v1" }]) {
  const again = apply(clientSong, "04/12/2026");
  assert.equal(again.releaseDate, "04/12/2026");
  assert.ok(again.steps.every(s => /^\d{2}\/\d{2}\/\d{4}$/.test(s.deadline)));
  assert.equal(again.steps.find(s => s.id === "mix").deadline, "01/11/2026");
  assert.equal(again.steps.find(s => s.id === "custom").deadline, "03/11/2026");
}
console.log("Repeated browser release edits accept stale ISO dates and retain display dates after API saves.");

const preserved = await saveProductionV1SongAtomically({ ...saved.song, releaseDate: "04/12/2026", steps: saved.song.steps.map(s => ({ ...s, deadline: "01/01/2030" })) }, "source-workspace", false);
assert.equal(persisted.releaseDate, "2026-12-04", "No still updates the release date");
assert.equal(persisted.deadline, "2026-11-13", "No retains the stored production deadline");
assert.deepEqual(persisted.steps.map(s => s.deadline), live.map(s => s.deadline), "No preserves all stored step dates, regardless of client calculations");
assert.equal(preserved.song.releaseDate, "04/12/2026");
console.log("No-recalculation choice preserves stored Production dates through the atomic API save.");

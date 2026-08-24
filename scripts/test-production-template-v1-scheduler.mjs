import assert from "node:assert/strict";
import {
  createProductionV1SongSnapshot,
  createProductionV1SongPlanFromSnapshot,
  getProductionV1TemplateDrift,
  instantiateProductionV1Song,
  recalculateProductionSong,
  recalculateProductionV1Song,
  sortProductionV1StepsByPosition
} from "../lib/production-template-v1.ts";

const template = (steps, version = 1) => ({
  id: "template-1",
  name: "Template",
  templateVersion: version,
  steps
});

const step = ({
  id,
  key = id,
  name = id,
  position,
  kind = "production_step",
  semantic = "standard",
  enabled = true,
  lead = 0,
  cost = 0
}) => ({
  id,
  stableKey: key,
  displayName: name,
  position,
  stepKind: kind,
  semanticKind: semantic,
  isEnabled: enabled,
  leadTimeDays: lead,
  standardCostAmount: cost
});

const idea = () => step({ id: "idea-id", key: "idea", name: "Idea", position: 0, kind: "idea_anchor" });
const release = () => step({ id: "release-id", key: "release", name: "Release", position: 1000, kind: "release_anchor" });
const standardTemplate = () => template([
  idea(),
  step({ id: "recording-id", key: "recording", name: "Recording", position: 100, lead: 3 }),
  step({ id: "mix-id", key: "mix", name: "Mix", position: 200, lead: 2 }),
  step({ id: "distribution-id", key: "delivery", name: "Deliver everywhere", position: 300, semantic: "distribution", lead: 14, cost: -10 }),
  release()
]);

const created = instantiateProductionV1Song(standardTemplate(), "2026-05-31");
assert.equal(created.productionDeadline, "2026-05-17", "distribution lead defines the production deadline");
assert.deepEqual(created.steps.map((item) => [item.id, item.deadline]), [
  ["idea-id", "2026-05-12"],
  ["recording-id", "2026-05-12"],
  ["mix-id", "2026-05-15"],
  ["distribution-id", "2026-05-17"]
]);
assert.equal(created.steps[0].status, "not-started");
assert.equal(created.snapshot.releaseAnchor.id, "release-id");
assert.equal(created.snapshot.steps[3].standardCostAmount, -10);

const noDistribution = instantiateProductionV1Song(template([
  idea(), step({ id: "master-id", name: "Master", position: 100, lead: 5 }), release()
]), "2026-05-31");
assert.equal(noDistribution.productionDeadline, "2026-05-31", "without distribution, deadline is the canonical release date");
assert.equal(noDistribution.steps[1].deadline, "2026-05-26");

const anchorsOnly = instantiateProductionV1Song(template([idea(), release()]), "2026-05-31");
assert.equal(anchorsOnly.productionDeadline, "2026-05-31");
assert.deepEqual(anchorsOnly.steps.map((item) => item.id), ["idea-id"]);
assert.equal(anchorsOnly.steps[0].deadline, "2026-05-31");

const disabledSnapshot = createProductionV1SongSnapshot(template([
  idea(), step({ id: "disabled-id", name: "Disabled", position: 100, enabled: false, lead: 12 }), release()
]));
assert.deepEqual(disabledSnapshot.steps.map((item) => item.id), ["idea-id"], "disabled middle steps are not instantiated");

const renamedDistribution = instantiateProductionV1Song(template([
  idea(), step({ id: "renamed-delivery", name: "Send it to fans", position: 100, semantic: "distribution", lead: 9 }), release()
]), "2026-05-31");
assert.equal(renamedDistribution.productionDeadline, "2026-05-22", "distribution identity is semantic, not display text");

const nonFinalDistribution = instantiateProductionV1Song(template([
  idea(),
  step({ id: "distribution-not-final", name: "Delivery", position: 100, semantic: "distribution", lead: 14 }),
  step({ id: "after-delivery", name: "Follow-up", position: 200, lead: 1 }),
  release()
]), "2026-05-31");
assert.equal(nonFinalDistribution.productionDeadline, "2026-05-17", "distribution lead remains Release-relative regardless of its display position");
assert.equal(nonFinalDistribution.steps[1].deadline, "2026-05-17");

const customMix = instantiateProductionV1Song(template([
  idea(), step({ id: "custom-step", key: "custom-step", name: "Mix", position: 100, lead: 4 }), release()
]), "2026-05-31");
assert.equal(customMix.productionDeadline, "2026-05-31");
assert.equal(customMix.steps[1].deadline, "2026-05-27", "a Mix display name has no special scheduling behavior");

const postponed = recalculateProductionV1Song(created, "2026-06-14");
assert.deepEqual(postponed.steps.map((item) => item.deadline), ["2026-05-26", "2026-05-26", "2026-05-29", "2026-05-31"]);
assert.deepEqual(postponed.steps.map((item) => item.position), [0, 100, 200, 300], "recalculation preserves workflow order");

const doneSong = structuredClone(created);
doneSong.steps[1].status = "done";
doneSong.steps[1].deadline = "2026-05-01";
const doneResult = recalculateProductionV1Song(doneSong, "2026-06-14");
assert.equal(doneResult.steps[1].deadline, "2026-05-01", "done deadline remains historical fact");
assert.equal(doneResult.steps[2].deadline, "2026-05-29");

const inProgressSong = structuredClone(created);
inProgressSong.steps[2].status = "in-progress";
inProgressSong.steps[2].deadline = "2026-05-10";
const inProgressResult = recalculateProductionV1Song(inProgressSong, "2026-06-14");
assert.equal(inProgressResult.steps[2].deadline, "2026-05-10", "in-progress deadline remains current reality");
assert.equal(inProgressResult.steps[3].deadline, "2026-05-31");

const mixedSong = structuredClone(created);
mixedSong.steps[0].status = "done";
mixedSong.steps[0].deadline = "2026-05-01";
mixedSong.steps[1].status = "in-progress";
mixedSong.steps[1].deadline = "2026-05-03";
const mixedResult = recalculateProductionV1Song(mixedSong, "2026-05-20");
assert.equal(mixedResult.steps[0].deadline, "2026-05-01");
assert.equal(mixedResult.steps[1].deadline, "2026-05-03");
assert.equal(mixedResult.steps[2].deadline, "2026-05-04");
assert.equal(mixedResult.steps[3].deadline, "2026-05-06");

const compressedSong = structuredClone(created);
compressedSong.steps[2].status = "done";
compressedSong.steps[2].deadline = "2026-06-10";
const compressedResult = recalculateProductionV1Song(compressedSong, "2026-05-20");
assert.ok(compressedResult.conflicts.some((conflict) => conflict.code === "workflow-order-inversion"));
assert.ok(compressedResult.warnings.some((warning) => warning.stepId === "mix-id"));
assert.equal(compressedResult.steps[2].deadline, "2026-06-10", "conflict detection never moves locked reality");

const snapshotBeforeTemplateEdit = instantiateProductionV1Song(standardTemplate(), "2026-05-31");
const editedTemplate = standardTemplate();
editedTemplate.steps[1].leadTimeDays = 99;
editedTemplate.steps[1].displayName = "Completely different";
const snapshotAfterTemplateEdit = recalculateProductionV1Song(snapshotBeforeTemplateEdit, "2026-06-14");
assert.equal(snapshotAfterTemplateEdit.steps[1].deadline, "2026-05-26", "live snapshot ignores later template edits");
assert.equal(snapshotAfterTemplateEdit.steps[1].displayName, "Recording");

const driftedTemplate = standardTemplate();
driftedTemplate.steps[3].leadTimeDays = 20;
driftedTemplate.steps.splice(3, 0, step({ id: "arrangement-id", key: "arrangement", name: "Arrangement", position: 250, lead: 1 }));
const drift = getProductionV1TemplateDrift(snapshotBeforeTemplateEdit.snapshot, driftedTemplate);
assert.equal(drift.isDrifted, true, "in-place workflow edits are template drift even when template version is unchanged");
assert.ok(drift.reasons.includes("workflow-steps"));
const newSongFromDriftedTemplate = instantiateProductionV1Song(driftedTemplate, "2026-06-14");
assert.equal(newSongFromDriftedTemplate.productionDeadline, "2026-05-25", "new songs use the current 20-day Distributor lead");
assert.ok(newSongFromDriftedTemplate.steps.some((item) => item.stableKey === "arrangement"), "new songs include current template steps");

const hydratedSnapshotPlan = createProductionV1SongPlanFromSnapshot({
  liveSteps: snapshotBeforeTemplateEdit.steps.map((item) => ({
    deadline: item.deadline,
    id: item.id,
    status: item.status
  })),
  productionDeadline: snapshotBeforeTemplateEdit.productionDeadline,
  releaseDate: snapshotBeforeTemplateEdit.releaseDate,
  snapshot: snapshotBeforeTemplateEdit.snapshot
});
const isolatedResult = recalculateProductionV1Song(hydratedSnapshotPlan, "2026-06-14");
assert.equal(isolatedResult.productionDeadline, "2026-05-31", "song snapshot retains its 14-day Distributor lead after template changes to 20 days");
assert.equal(isolatedResult.steps.some((item) => item.stableKey === "arrangement"), false, "song snapshot never gains a later template step");

const derivedCustomSnapshot = structuredClone(snapshotBeforeTemplateEdit.snapshot);
derivedCustomSnapshot.steps.splice(2, 0, {
  displayName: "Keyboard", id: "custom-keyboard-row", leadTimeDays: 2,
  position: 150, semanticKind: "standard", stableKey: "custom-keyboard-row",
  standardCostAmount: 0, stepKind: "production_step", timingMode: "derived"
});
const derivedCustomPlan = createProductionV1SongPlanFromSnapshot({
  liveSteps: [
    ...hydratedSnapshotPlan.steps.map((item) => ({ deadline: item.deadline, id: item.id, status: item.status })),
    { deadline: "2026-02-02", id: "custom-keyboard-row", status: "not-started" }
  ],
  productionDeadline: hydratedSnapshotPlan.productionDeadline,
  releaseDate: hydratedSnapshotPlan.releaseDate,
  snapshot: derivedCustomSnapshot
});
const derivedCustomResult = recalculateProductionV1Song(derivedCustomPlan, "2026-06-14");
assert.equal(derivedCustomResult.steps.find((item) => item.id === "custom-keyboard-row")?.deadline, "2026-05-27", "custom derived steps follow their next later workflow boundary");
assert.equal(derivedCustomResult.productionDeadline, "2026-05-31", "custom derived steps do not alter Distributor deadline semantics");
const lockedDerivedCustomPlan = structuredClone(derivedCustomPlan);
lockedDerivedCustomPlan.steps.find((item) => item.id === "custom-keyboard-row").status = "in-progress";
const lockedDerivedCustomResult = recalculateProductionV1Song(lockedDerivedCustomPlan, "2026-06-14");
assert.equal(lockedDerivedCustomResult.steps.find((item) => item.id === "custom-keyboard-row")?.deadline, "2026-02-02", "in-progress custom steps remain fixed");
assert.throws(
  () => createProductionV1SongPlanFromSnapshot({
    liveSteps: [...hydratedSnapshotPlan.steps.map((item) => ({ deadline: item.deadline, id: item.id, status: item.status })), { deadline: "2026-06-01", id: "unexpected", status: "not-started" }],
    productionDeadline: hydratedSnapshotPlan.productionDeadline,
    releaseDate: hydratedSnapshotPlan.releaseDate,
    snapshot: hydratedSnapshotPlan.snapshot
  }),
  /absent from its template snapshot/
);

const legacy = {
  schedulingModel: "legacy-v0",
  releaseDate: "2026-05-31",
  productionDeadline: "2026-05-17",
  steps: [{ label: "Mix", deadline: "2026-05-13", status: "not-started" }]
};
const legacyResult = recalculateProductionSong(legacy, "2026-06-14");
assert.equal(legacyResult.schedulingModel, "legacy-v0");
assert.equal(legacyResult.releaseDate, "2026-05-31", "the V1 engine does not alter legacy release scheduling");
assert.equal(legacyResult.steps[0].deadline, "2026-05-13");

assert.deepEqual(
  sortProductionV1StepsByPosition([{ position: 30 }, { position: 10 }, { position: 20 }]).map((item) => item.position),
  [10, 20, 30]
);

console.log("Production Template V1 scheduler checks passed.");

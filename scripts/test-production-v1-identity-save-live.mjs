import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  createProductionV1SongPlanFromSnapshot,
  recalculateProductionV1Song
} from "../lib/production-template-v1.ts";

const apply = process.argv.includes("--apply");
const songId = process.argv.at(process.argv.indexOf("--song-id") + 1);
if (!apply || !songId) throw new Error("Use --apply --song-id <BIOGLYCERIN template-v1 song UUID>.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function readState() {
  const { data: song, error: songError } = await service.from("production_songs").select("*").eq("id", songId).single();
  if (songError) throw songError;
  if (song.scheduling_model !== "template-v1") throw new Error("The selected song is not template-v1.");
  const { data: steps, error: stepsError } = await service.from("production_steps").select("*").eq("production_song_id", songId).order("position");
  if (stepsError) throw stepsError;
  const stepIds = steps.map((step) => step.id);
  const { data: tasks, error: tasksError } = await service.from("production_step_tasks").select("*").in("production_step_id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"]);
  if (tasksError) throw tasksError;
  const taskIds = tasks.map((task) => task.id);
  const { data: budgetLines, error: budgetError } = await service.from("production_budget_lines").select("*").or(`production_step_id.in.(${stepIds.join(",") || "00000000-0000-0000-0000-000000000000"}),production_step_task_id.in.(${taskIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  if (budgetError) throw budgetError;
  return { budgetLines, song, steps, tasks };
}

function payloadFrom(state) {
  const taskBudgetByTask = Map.groupBy(state.budgetLines.filter((line) => line.production_step_task_id), (line) => line.production_step_task_id);
  const stepBudgetByStep = Map.groupBy(state.budgetLines.filter((line) => line.production_step_id), (line) => line.production_step_id);
  const tasksByStep = Map.groupBy(state.tasks, (task) => task.production_step_id);
  return {
    albumArtUrl: state.song.album_art_url,
    dbId: state.song.id,
    deadline: state.song.production_deadline,
    id: state.song.slug,
    productionTemplateId: state.song.production_template_id,
    productionTemplateSnapshot: state.song.production_template_snapshot,
    productionTemplateVersion: state.song.production_template_version,
    releaseDate: state.song.release_date,
    roadmapPhaseId: state.song.roadmap_phase_id,
    schedulingModel: "template-v1",
    slug: state.song.slug,
    steps: state.steps.map((step) => ({
      budgetLines: (stepBudgetByStep.get(step.id) ?? []).map((line) => ({ amount: Number(line.amount), description: line.description, id: line.id })),
      deadline: step.step_deadline,
      extraTasks: (tasksByStep.get(step.id) ?? []).map((task) => ({
        budgetLines: (taskBudgetByTask.get(task.id) ?? []).map((line) => ({ amount: Number(line.amount), description: line.description, id: line.id })),
        id: task.id, position: task.position, status: task.status, title: task.title
      })),
      id: step.stable_key, isDefaultStep: step.is_default_step, label: step.label,
      notes: step.notes, position: step.position, status: step.status,
      templateStepId: step.template_step_id, templateStepKind: step.template_step_kind,
      templateStepLeadTimeDays: step.template_step_lead_time_days,
      templateStepStableKey: step.template_step_stable_key,
      templateStepStandardCostAmount: step.template_step_standard_cost_amount === null ? undefined : Number(step.template_step_standard_cost_amount)
    })),
    title: state.song.title
  };
}

async function save(payload, workspaceId) {
  const { error } = await service.rpc("save_production_v1_song_with_derived_custom_timing", { p_song: payload, p_workspace_id: workspaceId });
  if (error) throw error;
}

const before = await readState();
const originalPayload = payloadFrom(before);
const workspaceId = before.song.workspace_id;
const originalStepIds = before.steps.map((step) => step.id).sort();
const originalTaskIds = before.tasks.map((task) => task.id).sort();
const originalBudgetIds = before.budgetLines.map((line) => line.id).sort();
const derivedCustomSteps = before.steps.filter(
  (step) => step.template_step_id === null && step.template_step_stable_key?.startsWith("custom-")
);
let restored = false;

try {
  const shiftedPayload = structuredClone(originalPayload);
  const shiftedRelease = new Date(`${before.song.release_date}T00:00:00Z`);
  shiftedRelease.setUTCDate(shiftedRelease.getUTCDate() + 1);
  shiftedPayload.releaseDate = shiftedRelease.toISOString().slice(0, 10);
  const plan = createProductionV1SongPlanFromSnapshot({
    liveSteps: shiftedPayload.steps.map((step) => ({ deadline: step.deadline, id: step.templateStepId ?? step.id, status: step.status })),
    productionDeadline: shiftedPayload.deadline, releaseDate: shiftedPayload.releaseDate,
    snapshot: shiftedPayload.productionTemplateSnapshot
  });
  const recalculated = recalculateProductionV1Song(plan, shiftedPayload.releaseDate);
  shiftedPayload.deadline = recalculated.productionDeadline;
  shiftedPayload.steps = shiftedPayload.steps.map((step) => {
    const result = recalculated.steps.find((candidate) => candidate.id === (step.templateStepId ?? step.id));
    return result ? { ...step, deadline: result.deadline } : step;
  });
  await save(shiftedPayload, workspaceId);

  const shifted = await readState();
  assert.equal(shifted.song.release_date, shiftedPayload.releaseDate);
  assert.deepEqual(shifted.steps.map((step) => step.id).sort(), originalStepIds, "existing step IDs changed during V1 release recalculation");
  assert.deepEqual(shifted.tasks.map((task) => task.id).sort(), originalTaskIds, "task IDs changed during V1 release recalculation");
  assert.deepEqual(shifted.budgetLines.map((line) => line.id).sort(), originalBudgetIds, "budget IDs changed during V1 release recalculation");
  for (const customStep of derivedCustomSteps) {
    const nextBoundary = [...shifted.steps]
      .filter((step) => step.position > customStep.position)
      .sort((first, second) => first.position - second.position)[0];
    const expectedCustomDeadline = new Date(`${nextBoundary?.step_deadline ?? shifted.song.release_date}T00:00:00Z`);
    expectedCustomDeadline.setUTCDate(expectedCustomDeadline.getUTCDate() - customStep.template_step_lead_time_days);
    assert.equal(
      shifted.steps.find((step) => step.id === customStep.id)?.step_deadline,
      expectedCustomDeadline.toISOString().slice(0, 10),
      "derived custom step did not follow its next workflow boundary"
    );
  }
  for (const task of shifted.tasks) assert.ok(shifted.steps.some((step) => step.id === task.production_step_id));
  for (const line of shifted.budgetLines) assert.ok(shifted.steps.some((step) => step.id === line.production_step_id) || shifted.tasks.some((task) => task.id === line.production_step_task_id));

  await save(originalPayload, workspaceId);
  restored = true;
  const afterRestore = await readState();
  assert.equal(afterRestore.song.release_date, before.song.release_date);
  assert.equal(afterRestore.song.production_deadline, before.song.production_deadline);
  assert.deepEqual(afterRestore.steps.map((step) => step.id).sort(), originalStepIds);
  assert.deepEqual(afterRestore.tasks.map((task) => task.id).sort(), originalTaskIds);
  assert.deepEqual(afterRestore.budgetLines.map((line) => line.id).sort(), originalBudgetIds);
  if (derivedCustomSteps.length === 0) {
    assert.deepEqual(afterRestore.song.production_template_snapshot, before.song.production_template_snapshot);
  } else {
    for (const customStep of derivedCustomSteps) {
      const snapshotStep = afterRestore.song.production_template_snapshot.steps.find(
        (step) => step.id === customStep.stable_key
      );
      assert.equal(snapshotStep?.timingMode, "derived");
      assert.ok(Number.isInteger(snapshotStep?.leadTimeDays) && snapshotStep.leadTimeDays >= 0);
    }
  }

  const invalidPayload = structuredClone(originalPayload);
  invalidPayload.steps.push(structuredClone(invalidPayload.steps[0]));
  await assert.rejects(() => save(invalidPayload, workspaceId));
  const afterFailure = await readState();
  assert.deepEqual(afterFailure.steps.map((step) => step.id).sort(), originalStepIds, "failed save left a partial step mutation");
  console.log("Live Production V1 identity save verification passed and the original song state was restored.");
} finally {
  if (!restored) await save(originalPayload, workspaceId);
}

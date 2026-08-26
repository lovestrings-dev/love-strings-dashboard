import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const workspaceIds = new Set(), userIds = new Set();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const addDays = (date, days) => { const result = new Date(`${date}T00:00:00.000Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); };
const monthStart = (date) => `${date.slice(0, 7)}-01`;
const addMonths = (date, months) => { const result = new Date(`${date}T00:00:00.000Z`); result.setUTCMonth(result.getUTCMonth() + months); return result.toISOString().slice(0, 10); };

function workspaceToday(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: timezone || "Europe/Vienna", year: "numeric" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}-${parts.find((part) => part.type === "day").value}`;
}
async function user(label) {
  const email = `first-song-${label}-${suffix}@example.invalid`;
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true, password: `Test-${randomUUID()}-only` });
  if (error || !data.user) throw error ?? new Error("User creation failed.");
  userIds.add(data.user.id); return data.user;
}
async function stage(creator, recipient) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await service.rpc("create_provisional_workspace_admin_invitation", { p_created_by: creator.id, p_email: recipient.email, p_token_hash: hash(token) });
  if (error || !data?.[0]?.workspace_id) throw error ?? new Error("Workspace staging failed.");
  const staged = data[0]; workspaceIds.add(staged.workspace_id);
  const accepted = await service.rpc("accept_workspace_invitation", { p_email: recipient.email, p_token_hash: hash(token), p_user_id: recipient.id });
  if (accepted.error || accepted.data?.[0]?.outcome !== "accepted") throw accepted.error ?? new Error("Invitation acceptance failed.");
  return staged.workspace_id;
}
async function finalize(workspaceId, admin, releaseFrequency, distributorAnswer) {
  const { data, error } = await service.rpc("finalize_pending_workspace", {
    p_workspace_id: workspaceId, p_user_id: admin.id, p_display_name: `Admin ${releaseFrequency}`, p_workspace_name: `Bootstrap ${releaseFrequency} ${distributorAnswer}`,
    p_release_frequency: releaseFrequency, p_distributor_answer: distributorAnswer
  });
  if (error || data?.[0]?.outcome !== "finalized") throw error ?? new Error("Workspace finalization failed.");
}
async function create(workspaceId, title = "") {
  const { data, error } = await service.rpc("create_roadmap_aware_production_v1_song", { p_workspace_id: workspaceId, p_title: title });
  if (error) throw error;
  const song = data?.[0]; if (!song) throw new Error("Song creation returned no song."); return song;
}
async function state(workspaceId) {
  const [{ data: settings, error: settingsError }, { data: template, error: templateError }, { data: songs, error: songsError }, { data: plans, error: plansError }] = await Promise.all([
    service.from("app_workspace_settings").select("timezone, roadmap_standard_release_cadence_days").eq("workspace_id", workspaceId).single(),
    service.from("production_templates").select("id").eq("workspace_id", workspaceId).eq("is_active", true).single(),
    service.from("production_songs").select("id, title, release_date, production_deadline, roadmap_general_position, roadmap_phase_id, production_template_snapshot").eq("workspace_id", workspaceId).order("roadmap_general_position"),
    service.from("roadmap_planning_instances").select("id, plan_type, title, timeframe_start, timeframe_end, roadmap_planning_instance_songs(production_song_id)").eq("workspace_id", workspaceId).order("display_position")
  ]);
  if (settingsError || templateError || songsError || plansError) throw settingsError ?? templateError ?? songsError ?? plansError;
  const { data: steps, error: stepsError } = await service.from("production_template_steps").select("id, stable_key, step_kind, semantic_kind, is_enabled, lead_time_days, standard_cost_amount").eq("production_template_id", template.id).order("position");
  if (stepsError) throw stepsError;
  return { plans: plans ?? [], settings, songs: songs ?? [], steps: steps ?? [], template };
}
async function verifyProfile(creator, profile) {
  const admin = await user(profile.label); const workspaceId = await stage(creator, admin); await finalize(workspaceId, admin, profile.frequency, profile.distributor);
  const before = await state(workspaceId); assert.equal(before.songs.length, 0); assert.equal(before.plans.filter((plan) => plan.plan_type === "auto").length, 0);
  const today = workspaceToday(before.settings.timezone);
  const first = await create(workspaceId);
  const afterFirst = await state(workspaceId);
  const persisted = afterFirst.songs[0];
  assert.equal(first.title, "My Song Name"); assert.equal(persisted.title, "My Song Name"); assert.equal(persisted.roadmap_general_position, 1);
  const productionWindow = afterFirst.steps.filter((step) => step.step_kind === "production_step" && step.is_enabled && step.semantic_kind !== "distribution").reduce((total, step) => total + step.lead_time_days, 0);
  const distributorLead = afterFirst.steps.filter((step) => step.step_kind === "production_step" && step.is_enabled && step.semantic_kind === "distribution").reduce((total, step) => total + step.lead_time_days, 0);
  assert.equal(productionWindow, profile.productionWindow); assert.equal(distributorLead, profile.distributorLead);
  assert.equal(persisted.release_date, addDays(today, productionWindow + distributorLead));
  const autoPlans = afterFirst.plans.filter((plan) => plan.plan_type === "auto"); assert.equal(autoPlans.length, 1);
  const plan = autoPlans[0]; assert.equal(plan.title, "My Album Name"); assert.equal(plan.id, persisted.roadmap_phase_id);
  assert.equal(plan.timeframe_start, monthStart(today)); assert.equal(plan.timeframe_end, addMonths(monthStart(today), 11));
  assert.deepEqual(plan.roadmap_planning_instance_songs.map((membership) => membership.production_song_id), [persisted.id]);
  const { data: phase, error: phaseError } = await service.from("roadmap_phases").select("id, title, start_month, end_month").eq("workspace_id", workspaceId).eq("id", plan.id).single();
  if (phaseError) throw phaseError; assert.deepEqual(phase, { id: plan.id, title: "My Album Name", start_month: monthStart(today), end_month: addMonths(monthStart(today), 11) });
  const { data: liveSteps, error: liveStepsError } = await service.from("production_steps").select("id, template_step_stable_key, template_step_kind, template_step_lead_time_days, step_deadline, production_budget_lines(amount)").eq("production_song_id", persisted.id).order("position");
  if (liveStepsError) throw liveStepsError;
  assert.ok(liveSteps.some((step) => step.template_step_kind === "idea_anchor"));
  const distributorStep = liveSteps.find((step) => step.template_step_stable_key === "distributor-v1");
  if (profile.distributorLead) { assert.ok(distributorStep); assert.equal(distributorStep.step_deadline, addDays(persisted.release_date, -profile.distributorLead)); assert.equal(persisted.production_deadline, distributorStep.step_deadline); assert.deepEqual(distributorStep.production_budget_lines.map((line) => Number(line.amount)), [-10]); }
  else { assert.equal(distributorStep, undefined); }
  const expectedBudgetAmounts = afterFirst.steps.filter((step) => step.step_kind === "production_step" && step.is_enabled && Number(step.standard_cost_amount) !== 0).map((step) => Number(step.standard_cost_amount)).sort((a, b) => a - b);
  const actualBudgetAmounts = liveSteps.flatMap((step) => step.production_budget_lines.map((line) => Number(line.amount))).sort((a, b) => a - b);
  assert.deepEqual(actualBudgetAmounts, expectedBudgetAmounts);
  const second = await create(workspaceId, "Explicit Song Name");
  const afterSecond = await state(workspaceId);
  assert.equal(second.title, "Explicit Song Name"); assert.equal(second.roadmap_general_position, 2);
  assert.equal(second.release_date, addDays(persisted.release_date > today ? persisted.release_date : today, before.settings.roadmap_standard_release_cadence_days));
  assert.equal(afterSecond.plans.filter((item) => item.plan_type === "auto").length, 1);
  return { profile: profile.label, releaseDate: first.release_date, secondReleaseDate: second.release_date, workspaceId };
}
async function verifyTransactionSafety(creator, collisionWorkspaceId) {
  const admin = await user("rollback"); const workspaceId = await stage(creator, admin); await finalize(workspaceId, admin, "monthly", "no");
  const collisionId = `${workspaceId}-phase-1`;
  const { error: collisionError } = await service.from("roadmap_phases").insert({ id: collisionId, workspace_id: collisionWorkspaceId, phase_number: 999, title: "Collision", start_month: "2026-01-01", end_month: "2026-12-01", description: "", position: 999 });
  if (collisionError) throw collisionError;
  await assert.rejects(() => create(workspaceId));
  const after = await state(workspaceId); assert.equal(after.songs.length, 0); assert.equal(after.plans.filter((plan) => plan.plan_type === "auto").length, 0);
  return workspaceId;
}
async function cleanup() {
  if (workspaceIds.size) { const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]); if (error) throw error; }
  for (const id of userIds) { const { error } = await service.auth.admin.deleteUser(id); if (error) throw error; }
}

try {
  const creator = await user("creator");
  const results = [];
  for (const profile of [
    { label: "twice-no", frequency: "twice_monthly", distributor: "no", productionWindow: 14, distributorLead: 0 },
    { label: "twice-yes", frequency: "twice_monthly", distributor: "yes", productionWindow: 14, distributorLead: 14 },
    { label: "monthly-no", frequency: "monthly", distributor: "no", productionWindow: 28, distributorLead: 0 },
    { label: "monthly-yes", frequency: "monthly", distributor: "yes", productionWindow: 28, distributorLead: 14 }
  ]) results.push(await verifyProfile(creator, profile));
  await verifyTransactionSafety(creator, results[0].workspaceId);
  console.log(JSON.stringify({ profiles: results.map(({ profile, releaseDate, secondReleaseDate }) => ({ profile, releaseDate, secondReleaseDate })), transactionSafety: "passed" }, null, 2));
} finally { await cleanup(); }

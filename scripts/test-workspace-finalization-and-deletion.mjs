import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const userIds = [], workspaceIds = new Set();
const email = (label) => `ad-finalization-${label}-${suffix}@example.invalid`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function user(label) {
  const { data, error } = await service.auth.admin.createUser({ email: email(label), email_confirm: true, password: `Test-${randomUUID()}-only` });
  if (error || !data.user) throw error ?? new Error("User creation failed."); userIds.push(data.user.id); return data.user;
}
async function stage(creator, recipientEmail) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await service.rpc("create_provisional_workspace_admin_invitation", { p_created_by: creator.id, p_email: recipientEmail, p_token_hash: hash(token) });
  if (error) throw error; const result = data?.[0]; if (!result?.workspace_id) throw new Error("Staging failed."); workspaceIds.add(result.workspace_id); return { ...result, token };
}
async function accept(staged, recipient) {
  const { data, error } = await service.rpc("accept_workspace_invitation", { p_email: recipient.email, p_token_hash: hash(staged.token), p_user_id: recipient.id });
  if (error) throw error; assert.equal(data?.[0]?.outcome, "accepted");
}
async function finalize(workspaceId, recipient, userName, artistBandName, releaseFrequency = "monthly", distributorAnswer = "no") {
  const { data, error } = await service.rpc("finalize_pending_workspace", {
    p_display_name: userName,
    p_distributor_answer: distributorAnswer,
    p_release_frequency: releaseFrequency,
    p_user_id: recipient.id,
    p_workspace_id: workspaceId,
    p_workspace_name: artistBandName
  });
  if (error) throw error; return data?.[0];
}
async function assertSeededWorkspace(workspaceId, expected) {
  const [{ data: settings, error: settingsError }, { data: template, error: templateError }] = await Promise.all([
    service.from("app_workspace_settings").select("onboarding_release_frequency, onboarding_distributor_answer, roadmap_standard_release_cadence_days, marketing_song_campaign_length_days, marketing_song_campaign_advance_days").eq("workspace_id", workspaceId).single(),
    service.from("production_templates").select("id, production_template_steps(stable_key, semantic_kind, is_enabled, lead_time_days, standard_cost_amount)").eq("workspace_id", workspaceId).eq("is_active", true).single()
  ]);
  if (settingsError || templateError || !settings || !template) throw settingsError ?? templateError ?? new Error("Seeded workspace data was not found.");
  assert.deepEqual(settings, {
    onboarding_release_frequency: expected.releaseFrequency,
    onboarding_distributor_answer: expected.distributorAnswer,
    roadmap_standard_release_cadence_days: expected.cadence,
    marketing_song_campaign_length_days: expected.songCampaignLength,
    marketing_song_campaign_advance_days: expected.songCampaignAdvance
  });
  const steps = template.production_template_steps;
  const expectedSteps = expected.productionWindow === 14
    ? { "drums-v1": 1, "guitars-v1": 1, "bass-v1": 1, "vocals-v1": 2, "mix-v1": 4, "master-v1": 2, "license-v1": 2, "cover-art-v1": 1 }
    : { "drums-v1": 2, "guitars-v1": 2, "bass-v1": 2, "vocals-v1": 4, "mix-v1": 8, "master-v1": 4, "license-v1": 3, "cover-art-v1": 3 };
  const byKey = new Map(steps.map((step) => [step.stable_key, step]));
  for (const [stableKey, leadTimeDays] of Object.entries(expectedSteps)) assert.equal(byKey.get(stableKey)?.lead_time_days, leadTimeDays, stableKey);
  const productionWindow = steps.filter((step) => step.semantic_kind !== "distribution" && step.is_enabled).reduce((sum, step) => sum + step.lead_time_days, 0);
  assert.equal(productionWindow, expected.productionWindow);
  const distributor = byKey.get("distributor-v1");
  assert.equal(distributor?.is_enabled, expected.distributorEnabled);
  assert.equal(distributor?.lead_time_days, 14);
  assert.equal(Number(distributor?.standard_cost_amount), -10);
}
async function cleanup() {
  if (workspaceIds.size) { const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]); if (error) throw error; }
  for (const id of userIds) { const { error } = await service.auth.admin.deleteUser(id); if (error) throw error; }
}

try {
  const creator = await user("creator"), firstAdmin = await user("first-admin"), otherAdmin = await user("other-admin"), nonAdmin = await user("non-admin");
  const staged = await stage(creator, firstAdmin.email); await accept(staged, firstAdmin);
  const { data: before } = await service.from("app_workspaces").select("setup_state").eq("id", staged.workspace_id).single(); assert.equal(before.setup_state, "pending_setup");
  const collisionId = randomUUID(); workspaceIds.add(collisionId);
  for (const [table, row] of [["app_workspaces", { id: collisionId, name: "Collision", slug: "artistdeck-test" }], ["app_workspace_settings", { workspace_id: collisionId }], ["app_workspace_members", { workspace_id: collisionId, user_id: creator.id, role: "admin" }]]) { const { error } = await service.from(table).insert(row); if (error) throw error; }
  const result = await finalize(staged.workspace_id, firstAdmin, "Peter the Great", "ArtistDeck Test");
  assert.equal(result.outcome, "finalized"); assert.equal(result.workspace_slug, "artistdeck-test-2");
  const [{ data: finalized }, { data: profile }] = await Promise.all([service.from("app_workspaces").select("name, slug, setup_state").eq("id", staged.workspace_id).single(), service.from("app_profiles").select("display_name").eq("id", firstAdmin.id).single()]);
  assert.deepEqual(finalized, { name: "ArtistDeck Test", slug: "artistdeck-test-2", setup_state: "active" }); assert.equal(profile.display_name, "Peter the Great");
  await assertSeededWorkspace(staged.workspace_id, { releaseFrequency: "monthly", distributorAnswer: "no", cadence: 28, productionWindow: 28, distributorEnabled: false, songCampaignLength: 14, songCampaignAdvance: 3 });
  assert.equal((await finalize(staged.workspace_id, firstAdmin, "Changed", "Changed workspace")).outcome, "already_active");
  const { data: afterReplay } = await service.from("app_workspaces").select("name, slug").eq("id", staged.workspace_id).single(); assert.deepEqual(afterReplay, { name: "ArtistDeck Test", slug: "artistdeck-test-2" });
  await assert.rejects(() => finalize(staged.workspace_id, nonAdmin, "No", "Nope"));
  const subsequentToken = randomBytes(32).toString("base64url");
  const { error: inviteError } = await service.from("app_workspace_invitations").insert({ workspace_id: staged.workspace_id, created_by: firstAdmin.id, email: otherAdmin.email, role: "admin", token_hash: hash(subsequentToken) }); if (inviteError) throw inviteError;
  const { data: subsequent, error: subsequentError } = await service.rpc("accept_workspace_invitation", { p_email: otherAdmin.email, p_token_hash: hash(subsequentToken), p_user_id: otherAdmin.id }); if (subsequentError) throw subsequentError; assert.equal(subsequent?.[0]?.outcome, "accepted");
  const { data: stillActive } = await service.from("app_workspaces").select("setup_state, name, slug").eq("id", staged.workspace_id).single(); assert.deepEqual(stillActive, { setup_state: "active", name: "ArtistDeck Test", slug: "artistdeck-test-2" });
  for (const [label, releaseFrequency, distributorAnswer, cadence, productionWindow, distributorEnabled, songCampaignLength, songCampaignAdvance] of [
    ["twice-no", "twice_monthly", "no", 14, 14, false, 7, 2],
    ["twice-yes", "twice_monthly", "yes", 14, 14, true, 7, 2],
    ["monthly-yes", "monthly", "yes", 28, 28, true, 14, 3],
    ["undecided-unknown", "undecided", "unknown", 28, 28, false, 14, 3]
  ]) {
    const candidate = await user(label); const candidateStage = await stage(creator, candidate.email); await accept(candidateStage, candidate);
    assert.equal((await finalize(candidateStage.workspace_id, candidate, `Admin ${label}`, `ArtistDeck ${label}`, releaseFrequency, distributorAnswer)).outcome, "finalized");
    await assertSeededWorkspace(candidateStage.workspace_id, { releaseFrequency, distributorAnswer, cadence, productionWindow, distributorEnabled, songCampaignLength, songCampaignAdvance });
  }
  const failingAdmin = await user("rollback"); const failingStage = await stage(creator, failingAdmin.email); await accept(failingStage, failingAdmin);
  await assert.rejects(() => finalize(failingStage.workspace_id, failingAdmin, "Rollback Admin", "Rollback ArtistDeck", "invalid", "no"));
  const { data: failedWorkspace, error: failedWorkspaceError } = await service.from("app_workspaces").select("setup_state").eq("id", failingStage.workspace_id).single(); if (failedWorkspaceError) throw failedWorkspaceError;
  assert.equal(failedWorkspace.setup_state, "pending_setup");
  const { data: failedSettings, error: failedSettingsError } = await service.from("app_workspace_settings").select("onboarding_release_frequency, onboarding_distributor_answer").eq("workspace_id", failingStage.workspace_id).single(); if (failedSettingsError) throw failedSettingsError;
  assert.deepEqual(failedSettings, { onboarding_release_frequency: null, onboarding_distributor_answer: null });
  const pending = await stage(creator, email("pending-delete")); const pendingRecipient = await user("pending-delete");
  const { error: pendingDeleteError } = await service.from("app_workspaces").delete().eq("id", pending.workspace_id); if (pendingDeleteError) throw pendingDeleteError; workspaceIds.delete(pending.workspace_id);
  const { data: pendingGone } = await service.from("app_workspaces").select("id").eq("id", pending.workspace_id); assert.deepEqual(pendingGone, []); assert.ok((await service.auth.admin.getUserById(pendingRecipient.id)).data.user);
  const { error: activeDeleteError } = await service.from("app_workspaces").delete().eq("id", staged.workspace_id); if (activeDeleteError) throw activeDeleteError; workspaceIds.delete(staged.workspace_id);
  const [{ data: activeGone }, { data: preservedUser }] = await Promise.all([service.from("app_workspaces").select("id").eq("id", staged.workspace_id), service.auth.admin.getUserById(firstAdmin.id)]); assert.deepEqual(activeGone, []); assert.ok(preservedUser.user);
  console.log("Workspace finalization and deletion database verification passed.");
} finally { await cleanup(); }

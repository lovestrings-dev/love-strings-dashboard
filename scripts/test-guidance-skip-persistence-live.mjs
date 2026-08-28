import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const workspaceIds = new Set();
const userIds = new Set();
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function createUser() {
  const { data, error } = await service.auth.admin.createUser({
    email: `guidance-skip-${suffix}@example.invalid`,
    email_confirm: true,
    password: `Test-${randomUUID()}-only`
  });
  if (error || !data.user) throw error ?? new Error("User creation failed.");
  userIds.add(data.user.id);
  return data.user;
}

async function createWorkspace(user) {
  const token = randomBytes(32).toString("base64url");
  const staged = await service.rpc("create_provisional_workspace_admin_invitation", {
    p_created_by: user.id,
    p_email: user.email,
    p_token_hash: hash(token)
  });
  if (staged.error || !staged.data?.[0]?.workspace_id) throw staged.error ?? new Error("Workspace staging failed.");
  const workspaceId = staged.data[0].workspace_id;
  workspaceIds.add(workspaceId);
  const accepted = await service.rpc("accept_workspace_invitation", {
    p_email: user.email,
    p_token_hash: hash(token),
    p_user_id: user.id
  });
  if (accepted.error || accepted.data?.[0]?.outcome !== "accepted") throw accepted.error ?? new Error("Invitation acceptance failed.");
  const finalized = await service.rpc("finalize_pending_workspace", {
    p_display_name: "Guidance Skip QA",
    p_distributor_answer: "no",
    p_release_frequency: "monthly",
    p_user_id: user.id,
    p_workspace_id: workspaceId,
    p_workspace_name: `Guidance skip ${suffix}`
  });
  if (finalized.error || finalized.data?.[0]?.outcome !== "finalized") throw finalized.error ?? new Error("Workspace finalization failed.");
  return workspaceId;
}

async function status(workspaceId) {
  const { data, error } = await service.rpc("get_guidance_status", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data;
}

try {
  const user = await createUser();
  const workspaceId = await createWorkspace(user);
  assert.equal((await status(workspaceId)).nextStep, "first_song", "new workspace starts with First Song");

  const firstSkip = await service.rpc("skip_getting_started_guidance_step", { p_step: "first_song", p_workspace_id: workspaceId });
  if (firstSkip.error) throw firstSkip.error;
  assert.equal(firstSkip.data.nextStep, "google_youtube", "First Song skip advances to Google");
  assert.equal(firstSkip.data.completed, 1, "skip does not count as completion");
  assert.equal(firstSkip.data.skipped.first_song, true, "First Song skip persists in status response");
  assert.equal((await status(workspaceId)).nextStep, "google_youtube", "skip survives a fresh status request");

  const created = await service.rpc("create_roadmap_aware_production_v1_song", { p_title: "Skip persistence song", p_workspace_id: workspaceId });
  if (created.error) throw created.error;
  const afterSong = await status(workspaceId);
  assert.equal(afterSong.steps.first_song, true, "later real song creation remains canonical completion");
  assert.equal(afterSong.nextStep, "google_youtube", "completed skipped song does not resurrect the old action");

  const googleSkip = await service.rpc("skip_getting_started_guidance_step", { p_step: "google_youtube", p_workspace_id: workspaceId });
  if (googleSkip.error) throw googleSkip.error;
  assert.equal(googleSkip.data.nextStep, "invite_member", "Google skip advances to Invite Member");
  assert.equal(googleSkip.data.skipped.google_youtube, true, "Google skip persists in status response");

  const inviteSkip = await service.rpc("skip_getting_started_guidance_step", { p_step: "invite_member", p_workspace_id: workspaceId });
  if (inviteSkip.error) throw inviteSkip.error;
  assert.deepEqual(inviteSkip.data, { active: false }, "all remaining actions skipped hides the helper");
  assert.deepEqual(await status(workspaceId), { active: false }, "inactive skip state persists across fresh status requests");
  console.log("Guidance skip persistence live verification passed.");
} finally {
  if (workspaceIds.size) {
    const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]);
    if (error) throw error;
  }
  for (const userId of userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

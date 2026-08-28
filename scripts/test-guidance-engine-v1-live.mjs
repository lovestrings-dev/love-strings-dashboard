import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const workspaceIds = new Set(), userIds = new Set();
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function user(label) {
  const { data, error } = await service.auth.admin.createUser({ email: `guidance-${label}-${suffix}@example.invalid`, email_confirm: true, password: `Test-${randomUUID()}-only` });
  if (error || !data.user) throw error ?? new Error("User creation failed.");
  userIds.add(data.user.id); return data.user;
}
async function stage(creator, admin) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await service.rpc("create_provisional_workspace_admin_invitation", { p_created_by: creator.id, p_email: admin.email, p_token_hash: hash(token) });
  if (error || !data?.[0]?.workspace_id) throw error ?? new Error("Workspace staging failed.");
  const workspaceId = data[0].workspace_id; workspaceIds.add(workspaceId);
  const accepted = await service.rpc("accept_workspace_invitation", { p_email: admin.email, p_token_hash: hash(token), p_user_id: admin.id });
  if (accepted.error || accepted.data?.[0]?.outcome !== "accepted") throw accepted.error ?? new Error("Invitation acceptance failed.");
  return workspaceId;
}
async function finalize(workspaceId, admin, name) {
  const { data, error } = await service.rpc("finalize_pending_workspace", { p_workspace_id: workspaceId, p_user_id: admin.id, p_display_name: `Admin ${name}`, p_workspace_name: `Guidance ${name}`, p_release_frequency: "monthly", p_distributor_answer: "no" });
  if (error || data?.[0]?.outcome !== "finalized") throw error ?? new Error("Workspace finalization failed.");
}
async function status(workspaceId) {
  const { data, error } = await service.rpc("get_guidance_status", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data;
}
async function cleanup() {
  if (workspaceIds.size) { const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]); if (error) throw error; }
  for (const id of userIds) { const { error } = await service.auth.admin.deleteUser(id); if (error) throw error; }
}

try {
  const { data: mature, error: matureError } = await service.from("app_workspaces").select("id").is("guidance_eligible_at", null).limit(1).maybeSingle();
  if (matureError) throw matureError;
  assert.ok(mature, "a mature workspace fixture must remain ineligible");
  assert.deepEqual(await status(mature.id), { active: false }, "mature workspaces do not receive V1 onboarding");

  const creator = await user("creator"), firstAdmin = await user("first"), secondAdmin = await user("second");
  const firstWorkspace = await stage(creator, firstAdmin); await finalize(firstWorkspace, firstAdmin, "First");
  const secondWorkspace = await stage(creator, secondAdmin); await finalize(secondWorkspace, secondAdmin, "Second");

  assert.deepEqual(await status(firstWorkspace), {
    active: true, program: "getting_started_v1", completed: 1, total: 4, nextStep: "first_song",
    steps: { artistdeck_basics: true, first_song: false, google_youtube: false, invite_member: false },
    skipped: { artistdeck_basics: false, first_song: false, google_youtube: false, invite_member: false }
  }, "a new eligible workspace starts at 1 of 4");
  assert.equal((await status(secondWorkspace)).nextStep, "first_song", "progress is isolated between workspaces");

  const { error: googleError } = await service.from("app_google_connections").insert({
    workspace_id: firstWorkspace, connected_by: firstAdmin.id, google_account_email: `guidance-google-${suffix}@example.invalid`, google_account_subject: `guidance-subject-${suffix}`,
    encrypted_refresh_token: "test-only", youtube_enabled: true, youtube_channel_id: `guidance-channel-${suffix}`, youtube_channel_title: "Guidance Test Channel"
  });
  if (googleError) throw googleError;
  const googleFirst = await status(firstWorkspace);
  assert.equal(googleFirst.completed, 2); assert.equal(googleFirst.steps.google_youtube, true); assert.equal(googleFirst.nextStep, "first_song", "Google completion does not change configured step order");

  const { error: songError } = await service.rpc("create_roadmap_aware_production_v1_song", { p_workspace_id: firstWorkspace, p_title: "Guidance Independent Song" });
  if (songError) throw songError;
  const afterGoogleAndSong = await status(firstWorkspace);
  assert.equal(afterGoogleAndSong.active, true, "genuine 3 of 4 remains visible for the invite step");
  assert.equal(afterGoogleAndSong.completed, 3, "the first three canonical steps are complete");
  assert.equal(afterGoogleAndSong.nextStep, "invite_member", "the invitation is the final recommended action");
  const invitee = await user("invitee");
  const { error: inviteError } = await service.from("app_workspace_invitations").insert({
    workspace_id: firstWorkspace, created_by: firstAdmin.id, email: invitee.email, role: "member", token_hash: hash(randomBytes(32).toString("base64url"))
  });
  if (inviteError) throw inviteError;
  const completed = await status(firstWorkspace);
  assert.equal(completed.active, true, "genuine 4 of 4 remains visible until Close");
  assert.equal(completed.completed, 4, "all four canonical steps are complete");
  assert.equal(completed.nextStep, null, "4 of 4 has no further recommended action");
  const close = await service.rpc("dismiss_getting_started_guidance", { p_workspace_id: firstWorkspace });
  if (close.error) throw close.error;
  assert.deepEqual(close.data, { active: false }, "Close hides the helper without changing canonical product state");
  const { data: progress, error: progressError } = await service.from("app_guidance_program_progress").select("completed_at, dismissed_at").eq("workspace_id", firstWorkspace).eq("program_key", "getting_started_v1").single();
  if (progressError) throw progressError;
  assert.equal(progress.completed_at, null, "automatic canonical completion does not write the dismissal marker");
  assert.ok(progress.dismissed_at, "Close persists dismissal per workspace/program");
  assert.deepEqual(await status(firstWorkspace), { active: false }, "a dismissed program short-circuits subsequent status reads");
  console.log("Guidance Engine V1 live database verification passed.");
} finally { await cleanup(); }

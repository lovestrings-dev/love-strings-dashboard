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
async function finalize(workspaceId, recipient, userName, artistBandName) {
  const { data, error } = await service.rpc("finalize_pending_workspace", { p_display_name: userName, p_user_id: recipient.id, p_workspace_id: workspaceId, p_workspace_name: artistBandName });
  if (error) throw error; return data?.[0];
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
  assert.equal((await finalize(staged.workspace_id, firstAdmin, "Changed", "Changed workspace")).outcome, "already_active");
  const { data: afterReplay } = await service.from("app_workspaces").select("name, slug").eq("id", staged.workspace_id).single(); assert.deepEqual(afterReplay, { name: "ArtistDeck Test", slug: "artistdeck-test-2" });
  await assert.rejects(() => finalize(staged.workspace_id, nonAdmin, "No", "Nope"));
  const subsequentToken = randomBytes(32).toString("base64url");
  const { error: inviteError } = await service.from("app_workspace_invitations").insert({ workspace_id: staged.workspace_id, created_by: firstAdmin.id, email: otherAdmin.email, role: "admin", token_hash: hash(subsequentToken) }); if (inviteError) throw inviteError;
  const { data: subsequent, error: subsequentError } = await service.rpc("accept_workspace_invitation", { p_email: otherAdmin.email, p_token_hash: hash(subsequentToken), p_user_id: otherAdmin.id }); if (subsequentError) throw subsequentError; assert.equal(subsequent?.[0]?.outcome, "accepted");
  const { data: stillActive } = await service.from("app_workspaces").select("setup_state, name, slug").eq("id", staged.workspace_id).single(); assert.deepEqual(stillActive, { setup_state: "active", name: "ArtistDeck Test", slug: "artistdeck-test-2" });
  const pending = await stage(creator, email("pending-delete")); const pendingRecipient = await user("pending-delete");
  const { error: pendingDeleteError } = await service.from("app_workspaces").delete().eq("id", pending.workspace_id); if (pendingDeleteError) throw pendingDeleteError; workspaceIds.delete(pending.workspace_id);
  const { data: pendingGone } = await service.from("app_workspaces").select("id").eq("id", pending.workspace_id); assert.deepEqual(pendingGone, []); assert.ok((await service.auth.admin.getUserById(pendingRecipient.id)).data.user);
  const { error: activeDeleteError } = await service.from("app_workspaces").delete().eq("id", staged.workspace_id); if (activeDeleteError) throw activeDeleteError; workspaceIds.delete(staged.workspace_id);
  const [{ data: activeGone }, { data: preservedUser }] = await Promise.all([service.from("app_workspaces").select("id").eq("id", staged.workspace_id), service.auth.admin.getUserById(firstAdmin.id)]); assert.deepEqual(activeGone, []); assert.ok(preservedUser.user);
  console.log("Workspace finalization and deletion database verification passed.");
} finally { await cleanup(); }

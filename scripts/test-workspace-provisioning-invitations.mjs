import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const createdInvitationIds = [];
const createdWorkspaceIds = [];
const createdUserIds = [];

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createUser(label) {
  const email = `ad-provisioning-${label}-${suffix}@example.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `Test-${randomUUID()}-only`
  });
  if (error || !data.user) throw error ?? new Error("Test user was not created.");
  createdUserIds.push(data.user.id);
  return data.user;
}

async function createInvitation({ createdBy, email, expiresAt, revokedBy }) {
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const row = {
    created_by: createdBy,
    email: email.toLowerCase(),
    token_hash: hashToken(token),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    ...(revokedBy ? { revoked_at: new Date().toISOString(), revoked_by: revokedBy } : {})
  };
  const { data, error } = await service
    .from("app_workspace_provisioning_invitations")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  createdInvitationIds.push(data.id);
  return { id: data.id, tokenHash: row.token_hash };
}

async function accept(invitation, user, displayName, workspaceName) {
  const { data, error } = await service.rpc("accept_workspace_provisioning_invitation", {
    p_token_hash: invitation.tokenHash,
    p_user_id: user.id,
    p_display_name: displayName,
    p_workspace_name: workspaceName
  });
  if (error) throw error;
  return data?.[0];
}

async function getWorkspaceFoundation(workspaceId, userId) {
  const [workspace, settings, memberships, preferences] = await Promise.all([
    service.from("app_workspaces").select("id, name, slug").eq("id", workspaceId).single(),
    service.from("app_workspace_settings").select("workspace_id").eq("workspace_id", workspaceId).single(),
    service.from("app_workspace_members").select("user_id, role").eq("workspace_id", workspaceId),
    service.from("dashboard_preferences").select("workspace_id, user_id").eq("workspace_id", workspaceId).eq("user_id", userId).single()
  ]);
  for (const result of [workspace, settings, memberships, preferences]) {
    if (result.error) throw result.error;
  }
  return { memberships: memberships.data, preferences: preferences.data, settings: settings.data, workspace: workspace.data };
}

async function cleanup() {
  if (createdInvitationIds.length) {
    const { error } = await service
      .from("app_workspace_provisioning_invitations")
      .delete()
      .in("id", createdInvitationIds);
    if (error) throw error;
  }
  if (createdWorkspaceIds.length) {
    const { error } = await service.from("app_workspaces").delete().in("id", createdWorkspaceIds);
    if (error) throw error;
  }
  for (const userId of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

try {
  const operator = await createUser("operator");
  const recipient = await createUser("recipient");
  const wrongRecipient = await createUser("wrong-recipient");
  const collisionRecipient = await createUser("collision-recipient");

  const pending = await createInvitation({ createdBy: operator.id, email: recipient.email });
  const { data: pendingRow, error: pendingError } = await service
    .from("app_workspace_provisioning_invitations")
    .select("accepted_at, provisioned_workspace_id")
    .eq("id", pending.id)
    .single();
  if (pendingError) throw pendingError;
  assert.equal(pendingRow.accepted_at, null);
  assert.equal(pendingRow.provisioned_workspace_id, null);

  const successful = await accept(pending, recipient, "Peter the Great", `Provisioning Test ${suffix}`);
  assert.equal(successful.outcome, "accepted");
  assert.ok(successful.workspace_id);
  createdWorkspaceIds.push(successful.workspace_id);
  const foundation = await getWorkspaceFoundation(successful.workspace_id, recipient.id);
  assert.equal(foundation.workspace.name, `Provisioning Test ${suffix}`);
  assert.equal(foundation.memberships.length, 1);
  assert.deepEqual(foundation.memberships[0], { user_id: recipient.id, role: "admin" });
  assert.equal(foundation.settings.workspace_id, successful.workspace_id);
  assert.equal(foundation.preferences.workspace_id, successful.workspace_id);
  const { data: profile, error: profileError } = await service
    .from("app_profiles")
    .select("display_name")
    .eq("id", recipient.id)
    .single();
  if (profileError) throw profileError;
  assert.equal(profile.display_name, "Peter the Great");

  const replay = await accept(pending, recipient, "Ignored on replay", "Ignored on replay");
  assert.deepEqual(replay, successful);
  const replayFoundation = await getWorkspaceFoundation(successful.workspace_id, recipient.id);
  assert.equal(replayFoundation.memberships.length, 1);

  const wrongInvite = await createInvitation({ createdBy: operator.id, email: recipient.email });
  const wrongResult = await accept(wrongInvite, wrongRecipient, "Wrong", `Wrong Recipient ${suffix}`);
  assert.equal(wrongResult.outcome, "invalid");
  assert.equal(wrongResult.workspace_id, null);

  const expiredInvite = await createInvitation({
    createdBy: operator.id,
    email: wrongRecipient.email,
    expiresAt: new Date(Date.now() - 60_000).toISOString()
  });
  assert.equal((await accept(expiredInvite, wrongRecipient, "Wrong", `Expired ${suffix}`)).outcome, "expired");

  const revokedInvite = await createInvitation({
    createdBy: operator.id,
    email: wrongRecipient.email,
    revokedBy: operator.id
  });
  assert.equal((await accept(revokedInvite, wrongRecipient, "Wrong", `Revoked ${suffix}`)).outcome, "revoked");

  const collisionInvite = await createInvitation({ createdBy: operator.id, email: collisionRecipient.email });
  const collision = await accept(collisionInvite, collisionRecipient, "Collision User", `Provisioning Test ${suffix}!!!`);
  assert.equal(collision.outcome, "accepted");
  createdWorkspaceIds.push(collision.workspace_id);
  const { data: collisionWorkspace, error: collisionError } = await service
    .from("app_workspaces")
    .select("slug")
    .eq("id", collision.workspace_id)
    .single();
  if (collisionError) throw collisionError;
  assert.notEqual(collision.workspace_id, successful.workspace_id);
  assert.notEqual(collisionWorkspace.slug, foundation.workspace.slug);
  assert.match(collisionWorkspace.slug, /-2$/);

  const existingAccountInvite = await createInvitation({ createdBy: operator.id, email: recipient.email });
  const existingAccount = await accept(existingAccountInvite, recipient, "Peter the Great", `Existing Account ${suffix}`);
  assert.equal(existingAccount.outcome, "accepted");
  createdWorkspaceIds.push(existingAccount.workspace_id);
  const existingFoundation = await getWorkspaceFoundation(existingAccount.workspace_id, recipient.id);
  assert.equal(existingFoundation.memberships.length, 1);
  assert.equal(existingFoundation.memberships[0].role, "admin");
  const { data: recipientMemberships, error: recipientMembershipsError } = await service
    .from("app_workspace_members")
    .select("workspace_id, user_id, role")
    .eq("user_id", recipient.id)
    .in("workspace_id", [successful.workspace_id, existingAccount.workspace_id]);
  if (recipientMembershipsError) throw recipientMembershipsError;
  assert.deepEqual(
    recipientMemberships?.sort((left, right) => left.workspace_id.localeCompare(right.workspace_id)),
    [
      { workspace_id: successful.workspace_id, user_id: recipient.id, role: "admin" },
      { workspace_id: existingAccount.workspace_id, user_id: recipient.id, role: "admin" }
    ].sort((left, right) => left.workspace_id.localeCompare(right.workspace_id))
  );

  console.log("Workspace provisioning invitation database verification passed.");
} finally {
  await cleanup();
}

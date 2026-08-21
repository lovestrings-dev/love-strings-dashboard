import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendWorkspaceInvitationEmail } from "../lib/server/workspace-invitation-email.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const createdWorkspaceIds = new Set();
const createdUserIds = [];

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const syntheticEmail = (label) => `ad-provisional-${label}-${suffix}@example.invalid`;

async function createUser(email) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `Test-${randomUUID()}-only`
  });
  if (error || !data.user) throw error ?? new Error("Synthetic user was not created.");
  createdUserIds.push(data.user.id);
  return data.user;
}

async function stage(createdBy, email, token = randomBytes(32).toString("base64url")) {
  const { data, error } = await service.rpc("create_provisional_workspace_admin_invitation", {
    p_created_by: createdBy,
    p_email: email,
    p_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    p_token_hash: tokenHash(token)
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.workspace_id || !result.invitation_id) {
    throw new Error("Staging RPC did not return workspace and invitation IDs.");
  }
  if (result.created) createdWorkspaceIds.add(result.workspace_id);
  return { ...result, token };
}

async function assertWorkspaceFoundation(staged, email) {
  const [workspace, settings, memberships, invitation] = await Promise.all([
    service.from("app_workspaces").select("id, name, slug, setup_state").eq("id", staged.workspace_id).single(),
    service.from("app_workspace_settings").select("workspace_id").eq("workspace_id", staged.workspace_id).single(),
    service.from("app_workspace_members").select("user_id, role").eq("workspace_id", staged.workspace_id),
    service.from("app_workspace_invitations").select("id, email, role, accepted_at, revoked_at").eq("id", staged.invitation_id).single()
  ]);
  for (const result of [workspace, settings, memberships, invitation]) if (result.error) throw result.error;
  assert.deepEqual(workspace.data, {
    id: staged.workspace_id,
    name: "Pending workspace",
    slug: workspace.data.slug,
    setup_state: "pending_setup"
  });
  assert.match(workspace.data.slug, /^pending-[0-9a-f]{32}$/);
  assert.equal(settings.data.workspace_id, staged.workspace_id);
  assert.deepEqual(memberships.data, []);
  assert.deepEqual(invitation.data, {
    id: staged.invitation_id,
    email,
    role: "admin",
    accepted_at: null,
    revoked_at: null
  });
}

async function verifyEmailHandoffContract() {
  const newCalls = [];
  const newUserClient = {
    auth: {
      admin: {
        inviteUserByEmail: async (email, options) => {
          newCalls.push({ email, options });
          return { data: { user: { id: "synthetic" } }, error: null };
        }
      },
      signInWithOtp: async () => {
        throw new Error("Existing-user fallback should not run for a new recipient.");
      }
    }
  };
  assert.equal(await sendWorkspaceInvitationEmail(newUserClient, "fresh@example.invalid", "fresh-token"), "new_user");
  assert.match(newCalls[0].options.redirectTo, /workspace_invitation=fresh-token$/);

  const existingCalls = [];
  const existingUserClient = {
    auth: {
      admin: {
        inviteUserByEmail: async () => ({ data: { user: null }, error: new Error("User already registered") })
      },
      signInWithOtp: async (payload) => {
        existingCalls.push(payload);
        return { error: null };
      }
    }
  };
  assert.equal(await sendWorkspaceInvitationEmail(existingUserClient, "existing@example.invalid", "existing-token"), "existing_user");
  assert.equal(existingCalls[0].email, "existing@example.invalid");
  assert.match(existingCalls[0].options.emailRedirectTo, /workspace_invitation=existing-token&workspace_join=1$/);
}

async function cleanup() {
  if (createdWorkspaceIds.size) {
    const { error } = await service.from("app_workspaces").delete().in("id", [...createdWorkspaceIds]);
    if (error) throw error;
  }
  for (const userId of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

try {
  await verifyEmailHandoffContract();

  const { data: ownerPage, error: ownerError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (ownerError) throw ownerError;
  const platformOwner = ownerPage.users.find((user) => user.email === "artistdeck.app@gmail.com");
  assert.ok(platformOwner, "Dedicated Platform Owner account was not found.");
  const { data: ownerMemberships, error: ownerMembershipsError } = await service
    .from("app_workspace_members")
    .select("workspace_id")
    .eq("user_id", platformOwner.id);
  if (ownerMembershipsError) throw ownerMembershipsError;
  assert.deepEqual(ownerMemberships, []);

  const creator = await createUser(syntheticEmail("creator"));
  const freshEmail = syntheticEmail("fresh");
  const fresh = await stage(creator.id, freshEmail);
  assert.equal(fresh.created, true);
  await assertWorkspaceFoundation(fresh, freshEmail);
  const freshRecipient = await createUser(freshEmail);

  const duplicate = await stage(creator.id, freshEmail);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.workspace_id, fresh.workspace_id);
  assert.equal(duplicate.invitation_id, fresh.invitation_id);

  const existingRecipient = await createUser(syntheticEmail("existing"));
  const existingWorkspaceId = randomUUID();
  createdWorkspaceIds.add(existingWorkspaceId);
  const { error: baselineError } = await service.from("app_workspaces").insert({
    id: existingWorkspaceId,
    name: `Synthetic existing baseline ${suffix}`,
    slug: `ad-provisional-baseline-${suffix}`,
    setup_state: "active"
  });
  if (baselineError) throw baselineError;
  const { error: baselineSettingsError } = await service
    .from("app_workspace_settings")
    .insert({ workspace_id: existingWorkspaceId });
  if (baselineSettingsError) throw baselineSettingsError;
  const { error: baselineMembershipError } = await service.from("app_workspace_members").insert({
    workspace_id: existingWorkspaceId,
    user_id: existingRecipient.id,
    role: "admin"
  });
  if (baselineMembershipError) throw baselineMembershipError;
  const existing = await stage(creator.id, existingRecipient.email);
  assert.equal(existing.created, true);
  await assertWorkspaceFoundation(existing, existingRecipient.email);

  const accepted = await service.rpc("accept_workspace_invitation", {
    p_email: freshEmail,
    p_token_hash: tokenHash(fresh.token),
    p_user_id: freshRecipient.id
  });
  if (accepted.error) throw accepted.error;
  assert.equal(accepted.data?.[0]?.outcome, "accepted");
  assert.equal(accepted.data?.[0]?.workspace_id, fresh.workspace_id);

  const [pendingWorkspace, firstAdmin, preference] = await Promise.all([
    service.from("app_workspaces").select("setup_state").eq("id", fresh.workspace_id).single(),
    service.from("app_workspace_members").select("role").eq("workspace_id", fresh.workspace_id).single(),
    service.from("dashboard_preferences").select("workspace_id").eq("workspace_id", fresh.workspace_id).single()
  ]);
  for (const result of [pendingWorkspace, firstAdmin, preference]) if (result.error) throw result.error;
  assert.equal(pendingWorkspace.data.setup_state, "pending_setup");
  assert.equal(firstAdmin.data.role, "admin");
  assert.equal(preference.data.workspace_id, fresh.workspace_id);

  const existingAccepted = await service.rpc("accept_workspace_invitation", {
    p_email: existingRecipient.email,
    p_token_hash: tokenHash(existing.token),
    p_user_id: existingRecipient.id
  });
  if (existingAccepted.error) throw existingAccepted.error;
  assert.equal(existingAccepted.data?.[0]?.outcome, "accepted");
  const { data: existingMemberships, error: existingMembershipsError } = await service
    .from("app_workspace_members")
    .select("workspace_id, role")
    .eq("user_id", existingRecipient.id)
    .in("workspace_id", [existingWorkspaceId, existing.workspace_id]);
  if (existingMembershipsError) throw existingMembershipsError;
  assert.deepEqual(
    existingMemberships.sort((left, right) => left.workspace_id.localeCompare(right.workspace_id)),
    [
      { workspace_id: existingWorkspaceId, role: "admin" },
      { workspace_id: existing.workspace_id, role: "admin" }
    ].sort((left, right) => left.workspace_id.localeCompare(right.workspace_id))
  );

  console.log("Provisional workspace Admin invitation database verification passed.");
} finally {
  await cleanup();
}

import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const userIds = [];
const workspaceIds = new Set();
const email = (label) => `ad-freeze-${label}-${suffix}@example.invalid`;
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

async function createUser(label) {
  const { data, error } = await service.auth.admin.createUser({
    email: email(label),
    email_confirm: true,
    password: `Test-${randomUUID()}-only`,
  });
  if (error || !data.user) throw error ?? new Error("User creation failed.");
  userIds.push(data.user.id);
  return data.user;
}

async function createWorkspace(label, admin, sharedMember) {
  const id = randomUUID();
  workspaceIds.add(id);
  const { error } = await service.from("app_workspaces").insert({
    id,
    name: `ad-freeze-${label}-${suffix}`,
    slug: `ad-freeze-${label}-${suffix}`,
    setup_state: "active",
    access_state: "active",
  });
  if (error) throw error;
  const { error: settingsError } = await service.from("app_workspace_settings").insert({ workspace_id: id });
  if (settingsError) throw settingsError;
  for (const row of [
    { workspace_id: id, user_id: admin.id, role: "admin" },
    { workspace_id: id, user_id: sharedMember.id, role: "member" },
  ]) {
    const { error: membershipError } = await service.from("app_workspace_members").insert(row);
    if (membershipError) throw membershipError;
  }
  return id;
}

async function cleanup() {
  if (workspaceIds.size) {
    const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]);
    if (error) throw error;
  }
  for (const id of userIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}

try {
  const { data: authUsers, error: authUsersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsersError) throw authUsersError;
  const platformOwner = authUsers.users.find((user) => user.email === "artistdeck.app@gmail.com");
  assert.ok(platformOwner, "Dedicated Platform Owner account is missing.");
  const { data: platformOperators, error: platformOperatorsError } = await service
    .from("app_platform_operators")
    .select("user_id");
  if (platformOperatorsError) throw platformOperatorsError;
  assert.deepEqual(platformOperators?.map((operator) => operator.user_id), [platformOwner.id], "Platform Owner registry changed unexpectedly.");
  const { count: platformOwnerMembershipCount, error: platformOwnerMembershipError } = await service
    .from("app_workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", platformOwner.id);
  if (platformOwnerMembershipError) throw platformOwnerMembershipError;
  assert.equal(platformOwnerMembershipCount, 0, "Platform Owner must not receive workspace access.");

  const owner = await createUser("owner");
  const sharedMember = await createUser("member");
  const frozenWorkspaceId = await createWorkspace("primary", owner, sharedMember);
  const activeWorkspaceId = await createWorkspace("alternative", owner, sharedMember);

  const invitationToken = randomBytes(32).toString("base64url");
  const { error: invitationError } = await service.from("app_workspace_invitations").insert({
    workspace_id: frozenWorkspaceId,
    created_by: owner.id,
    email: email("future-member"),
    role: "viewer",
    token_hash: tokenHash(invitationToken),
  });
  if (invitationError) throw invitationError;

  const [{ data: settingsBefore, error: settingsBeforeError }, { data: membershipsBefore, error: membershipsBeforeError }, { data: invitationsBefore, error: invitationsBeforeError }] = await Promise.all([
    service.from("app_workspace_settings").select("workspace_id").eq("workspace_id", frozenWorkspaceId),
    service.from("app_workspace_members").select("user_id, role").eq("workspace_id", frozenWorkspaceId).order("user_id"),
    service.from("app_workspace_invitations").select("id").eq("workspace_id", frozenWorkspaceId),
  ]);
  if (settingsBeforeError || membershipsBeforeError || invitationsBeforeError) throw settingsBeforeError ?? membershipsBeforeError ?? invitationsBeforeError;
  assert.equal(settingsBefore?.length, 1);
  assert.equal(membershipsBefore?.length, 2);
  assert.equal(invitationsBefore?.length, 1);

  const { error: freezeError } = await service.from("app_workspaces").update({ access_state: "frozen" }).eq("id", frozenWorkspaceId);
  if (freezeError) throw freezeError;
  const [{ data: frozenWorkspace, error: frozenWorkspaceError }, { data: membershipsFrozen, error: membershipsFrozenError }, { data: invitationsFrozen, error: invitationsFrozenError }] = await Promise.all([
    service.from("app_workspaces").select("access_state").eq("id", frozenWorkspaceId).single(),
    service.from("app_workspace_members").select("user_id, role").eq("workspace_id", frozenWorkspaceId).order("user_id"),
    service.from("app_workspace_invitations").select("id").eq("workspace_id", frozenWorkspaceId),
  ]);
  if (frozenWorkspaceError || membershipsFrozenError || invitationsFrozenError) throw frozenWorkspaceError ?? membershipsFrozenError ?? invitationsFrozenError;
  assert.equal(frozenWorkspace.access_state, "frozen");
  assert.deepEqual(membershipsFrozen, membershipsBefore);
  assert.deepEqual(invitationsFrozen, invitationsBefore);

  const { data: sharedMemberships, error: sharedMembershipsError } = await service
    .from("app_workspace_members")
    .select("workspace_id")
    .eq("user_id", sharedMember.id);
  if (sharedMembershipsError) throw sharedMembershipsError;
  const { data: sharedWorkspaceStates, error: sharedWorkspaceStatesError } = await service
    .from("app_workspaces")
    .select("id, access_state")
    .in("id", (sharedMemberships ?? []).map((membership) => membership.workspace_id));
  if (sharedWorkspaceStatesError) throw sharedWorkspaceStatesError;
  const stateByWorkspaceId = new Map((sharedWorkspaceStates ?? []).map((workspace) => [workspace.id, workspace.access_state]));
  const accessibleWorkspaceIds = (sharedMemberships ?? [])
    .filter((membership) => stateByWorkspaceId.get(membership.workspace_id) === "active")
    .map((membership) => membership.workspace_id);
  assert.deepEqual(accessibleWorkspaceIds, [activeWorkspaceId]);

  const { error: reactivateError } = await service.from("app_workspaces").update({ access_state: "active" }).eq("id", frozenWorkspaceId);
  if (reactivateError) throw reactivateError;
  const { data: reactivated, error: reactivatedError } = await service.from("app_workspaces").select("access_state").eq("id", frozenWorkspaceId).single();
  if (reactivatedError) throw reactivatedError;
  assert.equal(reactivated.access_state, "active");
  const { count: membershipCountAfterReactivate, error: membershipCountError } = await service.from("app_workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", frozenWorkspaceId);
  if (membershipCountError) throw membershipCountError;
  assert.equal(membershipCountAfterReactivate, 2);

  const { error: refreezeError } = await service.from("app_workspaces").update({ access_state: "frozen" }).eq("id", frozenWorkspaceId);
  if (refreezeError) throw refreezeError;
  const { error: frozenDeleteError } = await service.from("app_workspaces").delete().eq("id", frozenWorkspaceId);
  if (frozenDeleteError) throw frozenDeleteError;
  workspaceIds.delete(frozenWorkspaceId);
  const [{ data: deletedWorkspace }, { count: activeMembershipCount, error: activeMembershipError }, { data: ownerAfterDelete }, { data: memberAfterDelete }] = await Promise.all([
    service.from("app_workspaces").select("id").eq("id", frozenWorkspaceId),
    service.from("app_workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId).eq("user_id", sharedMember.id),
    service.auth.admin.getUserById(owner.id),
    service.auth.admin.getUserById(sharedMember.id),
  ]);
  if (activeMembershipError) throw activeMembershipError;
  assert.deepEqual(deletedWorkspace, []);
  assert.equal(activeMembershipCount, 1);
  assert.ok(ownerAfterDelete.user);
  assert.ok(memberAfterDelete.user);

  console.log("Workspace freeze/reactivate database verification passed.");
} finally {
  await cleanup();
  const [{ data: remainingFixtures, error: remainingFixturesError }, { data: remainingInvitations, error: remainingInvitationsError }, { data: remainingUsers, error: remainingUsersError }] = await Promise.all([
    service.from("app_workspaces").select("id").ilike("name", "ad-freeze-%"),
    service.from("app_workspace_invitations").select("id").ilike("email", "ad-freeze-%"),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (remainingFixturesError || remainingInvitationsError || remainingUsersError) throw remainingFixturesError ?? remainingInvitationsError ?? remainingUsersError;
  assert.equal(remainingFixtures?.length, 0, "Synthetic freeze workspaces remain.");
  assert.equal(remainingInvitations?.length, 0, "Synthetic freeze invitations remain.");
  assert.equal(remainingUsers.users.filter((user) => user.email?.startsWith("ad-freeze-")).length, 0, "Synthetic freeze Auth users remain.");
}

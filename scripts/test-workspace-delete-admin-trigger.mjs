import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration is required.");

const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const userIds = [];
let workspaceId = null;

async function createUser(label) {
  const { data, error } = await service.auth.admin.createUser({
    email: `ad-provisioning-trigger-${label}-${suffix}@example.invalid`,
    email_confirm: true,
    password: `Test-${randomUUID()}-only`
  });
  if (error || !data.user) throw error ?? new Error("Test user was not created.");
  userIds.push(data.user.id);
  return data.user;
}

try {
  const firstAdmin = await createUser("first-admin");
  const secondAdmin = await createUser("second-admin");
  const { data: workspace, error: workspaceError } = await service
    .from("app_workspaces")
    .insert({ name: `Trigger Test ${suffix}`, slug: `trigger-test-${suffix}` })
    .select("id")
    .single();
  if (workspaceError) throw workspaceError;
  workspaceId = workspace.id;
  const { error: memberError } = await service
    .from("app_workspace_members")
    .insert({ workspace_id: workspaceId, user_id: firstAdmin.id, role: "admin" });
  if (memberError) throw memberError;

  const soleDelete = await service
    .from("app_workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", firstAdmin.id);
  assert.ok(soleDelete.error);
  assert.match(soleDelete.error.message, /at least one Admin/);

  const { error: secondMembershipError } = await service
    .from("app_workspace_members")
    .insert({ workspace_id: workspaceId, user_id: secondAdmin.id, role: "admin" });
  if (secondMembershipError) throw secondMembershipError;
  const multiAdminDelete = await service
    .from("app_workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", firstAdmin.id);
  if (multiAdminDelete.error) throw multiAdminDelete.error;
  const { data: remaining, error: remainingError } = await service
    .from("app_workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  if (remainingError) throw remainingError;
  assert.deepEqual(remaining, [{ user_id: secondAdmin.id, role: "admin" }]);

  const { error: workspaceDeleteError } = await service.from("app_workspaces").delete().eq("id", workspaceId);
  if (workspaceDeleteError) throw workspaceDeleteError;
  const { data: deletedWorkspace, error: deletedWorkspaceError } = await service
    .from("app_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (deletedWorkspaceError) throw deletedWorkspaceError;
  assert.equal(deletedWorkspace, null);
  workspaceId = null;
  console.log("Workspace Admin deletion trigger regression verification passed.");
} finally {
  if (workspaceId) await service.from("app_workspaces").delete().eq("id", workspaceId);
  for (const userId of userIds) await service.auth.admin.deleteUser(userId);
}

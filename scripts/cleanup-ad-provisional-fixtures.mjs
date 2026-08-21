import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const prefix = "ad-provisional-";

const { data: userPage, error: userError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (userError) throw userError;
const users = userPage.users.filter((user) => user.email?.startsWith(prefix));
const userIds = users.map((user) => user.id);
const emails = users.map((user) => user.email.toLowerCase());

const [{ data: invitations, error: invitationError }, { data: memberships, error: membershipError }] = await Promise.all([
  service.from("app_workspace_invitations").select("workspace_id").ilike("email", `${prefix}%`),
  userIds.length
    ? service.from("app_workspace_members").select("workspace_id").in("user_id", userIds)
    : Promise.resolve({ data: [], error: null })
]);
if (invitationError) throw invitationError;
if (membershipError) throw membershipError;
const workspaceIds = [...new Set([...(invitations ?? []).map((row) => row.workspace_id), ...(memberships ?? []).map((row) => row.workspace_id)])];

if (workspaceIds.length) {
  const { error } = await service.from("app_workspaces").delete().in("id", workspaceIds);
  if (error) throw error;
}
for (const user of users) {
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) throw error;
}

const [{ count: remainingInvitationCount, error: remainingInvitationError }, { data: remainingUsersPage, error: remainingUserError }] = await Promise.all([
  service.from("app_workspace_invitations").select("id", { count: "exact", head: true }).ilike("email", `${prefix}%`),
  service.auth.admin.listUsers({ page: 1, perPage: 1000 })
]);
if (remainingInvitationError) throw remainingInvitationError;
if (remainingUserError) throw remainingUserError;
const remainingUsers = remainingUsersPage.users.filter((user) => user.email?.startsWith(prefix));
if (remainingUsers.length || (remainingInvitationCount ?? 0) !== 0) {
  throw new Error("Synthetic provisional fixtures remain after cleanup.");
}

console.log(JSON.stringify({
  deletedAuthUsers: users.length,
  deletedWorkspaces: workspaceIds.length,
  remainingAuthUsers: remainingUsers.length,
  remainingInvitations: remainingInvitationCount ?? 0,
  syntheticEmailsInventoried: emails.length
}));

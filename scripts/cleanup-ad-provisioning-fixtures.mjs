import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const prefix = "ad-provisioning-";
const testUsers = [];

for (let page = 1; ; page += 1) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const matching = data.users.filter((user) => user.email?.startsWith(prefix));
  testUsers.push(...matching);
  if (data.users.length < 1000) break;
}

const userIds = testUsers.map((user) => user.id);
const { data: memberships, error: membershipsError } = userIds.length
  ? await service.from("app_workspace_members").select("workspace_id").in("user_id", userIds)
  : { data: [], error: null };
if (membershipsError) throw membershipsError;
const workspaceIds = [...new Set((memberships ?? []).map((membership) => membership.workspace_id))];

console.log(`Inventory: ${userIds.length} temporary Auth users and ${workspaceIds.length} temporary workspaces.`);

if (workspaceIds.length) {
  const { error } = await service.from("app_workspaces").delete().in("id", workspaceIds);
  if (error) throw error;
}
for (const userId of userIds) {
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) throw error;
}

console.log(`Removed: ${userIds.length} temporary Auth users and ${workspaceIds.length} temporary workspaces.`);

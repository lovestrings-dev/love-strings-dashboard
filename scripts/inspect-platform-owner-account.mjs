import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration is required.");

const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const targetEmail = "artistdeck.app@gmail.com";
const operatorEmails = ["artistdeck.app@gmail.com", "dimasounder@gmail.com"];
const users = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const target = users.find((user) => user.email?.toLowerCase() === targetEmail) ?? null;
const selectedUsers = users.filter((user) => operatorEmails.includes(user.email?.toLowerCase() ?? ""));
const ids = selectedUsers.map((user) => user.id);
const [profiles, memberships, operators] = await Promise.all([
  target ? service.from("app_profiles").select("id, display_name, created_at").eq("id", target.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  target ? service.from("app_workspace_members").select("workspace_id, role").eq("user_id", target.id) : Promise.resolve({ data: [], error: null }),
  ids.length ? service.from("app_platform_operators").select("user_id, created_at").in("user_id", ids) : Promise.resolve({ data: [], error: null })
]);
for (const result of [profiles, memberships, operators]) if (result.error) throw result.error;
console.log(JSON.stringify({
  target: target ? { id: target.id, email: target.email } : null,
  profile: profiles.data,
  memberships: memberships.data ?? [],
  operators: (operators.data ?? []).map((operator) => ({
    email: selectedUsers.find((user) => user.id === operator.user_id)?.email ?? "unknown",
    userId: operator.user_id,
    createdAt: operator.created_at
  }))
}, null, 2));

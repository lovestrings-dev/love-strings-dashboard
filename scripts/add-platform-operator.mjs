import { createClient } from "@supabase/supabase-js";

const targetEmail = process.argv[2]?.trim().toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://love-strings-dashboard.vercel.app").replace(/\/$/, "");
if (!targetEmail || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Usage: add-platform-operator.mjs <email> with Supabase service configuration.");
}

const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

let user = users.find((candidate) => candidate.email?.toLowerCase() === targetEmail) ?? null;
let accountCreated = false;
if (!user) {
  const { data, error } = await service.auth.admin.inviteUserByEmail(targetEmail, {
    redirectTo: `${publicSiteUrl}/set-password`
  });
  if (error || !data.user) throw error ?? new Error("Supabase did not return the invited Auth user.");
  user = data.user;
  accountCreated = true;
}

const [profile, memberships] = await Promise.all([
  service.from("app_profiles").select("id, display_name").eq("id", user.id).maybeSingle(),
  service.from("app_workspace_members").select("workspace_id, role").eq("user_id", user.id)
]);
if (profile.error) throw profile.error;
if (memberships.error) throw memberships.error;
if (!profile.data) throw new Error("Auth user exists but its automatic app_profiles row was not created.");
if ((memberships.data ?? []).length > 0) {
  throw new Error("Refusing to add operator authority: the account already has workspace memberships.");
}

const { error: operatorError } = await service
  .from("app_platform_operators")
  .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
if (operatorError) throw operatorError;
const { data: operator, error: operatorReadError } = await service
  .from("app_platform_operators")
  .select("user_id, created_at")
  .eq("user_id", user.id)
  .single();
if (operatorReadError) throw operatorReadError;

console.log(JSON.stringify({
  accountCreated,
  email: user.email,
  profile: profile.data,
  memberships: memberships.data ?? [],
  operator
}, null, 2));

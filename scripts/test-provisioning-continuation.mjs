import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.TEST_APP_URL ?? "http://localhost:3001";
if (!url || !serviceKey) throw new Error("Supabase configuration is required.");
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const userIds = []; const inviteIds = [];
const tokenHash = () => createHash("sha256").update(randomBytes(32).toString("base64url")).digest("hex");

async function user(label, password = `Test-${randomUUID()}-only`) {
  const email = `ad-provisioning-continuation-${label}-${suffix}@example.invalid`;
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true, password });
  if (error || !data.user) throw error ?? new Error("User creation failed."); userIds.push(data.user.id); return data.user;
}
async function invite(createdBy, email, extra = {}) {
  const { data, error } = await service.from("app_workspace_provisioning_invitations").insert({ created_by: createdBy, email, token_hash: tokenHash(), ...extra }).select("id").single();
  if (error) throw error; inviteIds.push(data.id); return data.id;
}
async function session(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password }); if (error || !data.session) throw error ?? new Error("Session creation failed."); return data.session.access_token;
}
async function continuation(accessToken) {
  const response = await fetch(`${appUrl}/api/platform/provisioning-invitations/continuation`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  return { body: await response.json(), status: response.status };
}

try {
  const password = `Test-${randomUUID()}-only`;
  const creator = await user("creator");
  const recipientEmail = `ad-provisioning-continuation-recipient-${suffix}@example.invalid`;
  const { data: recipientData, error: recipientError } = await service.auth.admin.createUser({ email: recipientEmail, email_confirm: true, password });
  if (recipientError || !recipientData.user) throw recipientError ?? new Error("Recipient creation failed."); userIds.push(recipientData.user.id);
  const wrongPassword = `Test-${randomUUID()}-only`;
  const wrong = await user("wrong", wrongPassword);
  await invite(creator.id, recipientEmail);
  const result = await continuation(await session(recipientEmail, password));
  assert.equal(result.status, 200); assert.ok(result.body.continuation?.token); assert.equal(typeof result.body.continuation.displayName, "string");
  const wrongResult = await continuation(await session(wrong.email, wrongPassword));
  assert.equal(wrongResult.body.continuation, null);
  console.log("Provisioning continuation endpoint verification passed.");
} finally {
  if (inviteIds.length) await service.from("app_workspace_provisioning_invitations").delete().in("id", inviteIds);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
}

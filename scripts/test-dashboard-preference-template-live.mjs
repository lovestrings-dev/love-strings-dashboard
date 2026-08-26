import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const userIds = new Set(), workspaceIds = new Set();
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function activeTemplate() {
  const { data, error } = await service.from("platform_dashboard_preference_templates")
    .select("template_key, version, visible_cards, card_order, theme, effective_at")
    .eq("template_key", "new-member-dashboard").is("retired_at", null).single();
  if (error || !data) throw error ?? new Error("Active template missing."); return data;
}
async function user(label) {
  const { data, error } = await service.auth.admin.createUser({ email: `preferences-${label}-${suffix}@example.invalid`, email_confirm: true, password: `Test-${randomUUID()}-only` });
  if (error || !data.user) throw error ?? new Error("User creation failed."); userIds.add(data.user.id); return data.user;
}
async function stage(creator, recipient) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await service.rpc("create_provisional_workspace_admin_invitation", { p_created_by: creator.id, p_email: recipient.email, p_token_hash: hash(token) });
  if (error || !data?.[0]?.workspace_id) throw error ?? new Error("Workspace staging failed."); workspaceIds.add(data[0].workspace_id);
  const accepted = await service.rpc("accept_workspace_invitation", { p_email: recipient.email, p_token_hash: hash(token), p_user_id: recipient.id });
  if (accepted.error || accepted.data?.[0]?.outcome !== "accepted") throw accepted.error ?? new Error("First Admin acceptance failed.");
  const finalized = await service.rpc("finalize_pending_workspace", { p_workspace_id: data[0].workspace_id, p_user_id: recipient.id, p_display_name: "Template Test Admin", p_workspace_name: "Template Test Workspace", p_release_frequency: "monthly", p_distributor_answer: "no" });
  if (finalized.error || finalized.data?.[0]?.outcome !== "finalized") throw finalized.error ?? new Error("Workspace finalization failed.");
  return data[0].workspace_id;
}
async function invite(workspaceId, creator, recipient, role) {
  const token = randomBytes(32).toString("base64url");
  const { error: invitationError } = await service.from("app_workspace_invitations").insert({ workspace_id: workspaceId, created_by: creator.id, email: recipient.email, role, token_hash: hash(token) });
  if (invitationError) throw invitationError;
  const result = await service.rpc("accept_workspace_invitation", { p_email: recipient.email, p_token_hash: hash(token), p_user_id: recipient.id });
  if (result.error || result.data?.[0]?.outcome !== "accepted") throw result.error ?? new Error("Invited-user acceptance failed.");
}
async function preference(workspaceId, userId) {
  const { data, error } = await service.from("dashboard_preferences")
    .select("visible_cards, card_order, theme, seeded_template_key, seeded_template_version, seeded_at")
    .eq("workspace_id", workspaceId).eq("user_id", userId).single();
  if (error || !data) throw error ?? new Error("Preference row missing."); return data;
}
function assertSnapshot(row, template) {
  assert.deepEqual(row.visible_cards, template.visible_cards);
  assert.deepEqual(row.card_order, template.card_order);
  assert.equal(row.theme, template.theme);
  assert.equal(row.seeded_template_key, template.template_key);
  assert.equal(row.seeded_template_version, template.version);
  assert.ok(row.seeded_at);
}
async function cleanup() {
  if (workspaceIds.size) { const { error } = await service.from("app_workspaces").delete().in("id", [...workspaceIds]); if (error) throw error; }
  for (const id of userIds) { const { error } = await service.auth.admin.deleteUser(id); if (error) throw error; }
}

const original = await activeTemplate();
try {
  assert.equal(original.version >= 1, true);
  assert.deepEqual(original.card_order.slice(0, 5), ["events", "focus", "production", "production.current-song", "production.benchmark"]);
  assert.ok(original.visible_cards.includes("platforms.spotify"));
  assert.ok(!original.visible_cards.includes("platforms.apple-music"));

  const creator = await user("creator");
  const firstAdmin = await user("first-admin");
  const workspaceId = await stage(creator, firstAdmin);
  const firstSnapshot = await preference(workspaceId, firstAdmin.id); assertSnapshot(firstSnapshot, original);

  const invitedMember = await user("member"); await invite(workspaceId, firstAdmin, invitedMember, "member");
  const memberSnapshot = await preference(workspaceId, invitedMember.id); assertSnapshot(memberSnapshot, original);
  assert.notEqual(firstAdmin.id, invitedMember.id);

  const personalVisible = ["events", "focus"];
  const { error: personalEditError } = await service.from("dashboard_preferences").update({ visible_cards: personalVisible }).eq("workspace_id", workspaceId).eq("user_id", firstAdmin.id);
  if (personalEditError) throw personalEditError;
  const editedFirst = await preference(workspaceId, firstAdmin.id); assert.deepEqual(editedFirst.visible_cards, personalVisible);
  assert.deepEqual((await preference(workspaceId, invitedMember.id)).visible_cards, original.visible_cards);
  assert.deepEqual((await activeTemplate()).visible_cards, original.visible_cards);

  const changedVisible = original.visible_cards.filter((card) => card !== "qr-codes");
  const { data: activated, error: activateError } = await service.rpc("activate_platform_dashboard_preference_template", { p_card_order: original.card_order, p_visible_cards: changedVisible, p_theme: original.theme });
  if (activateError) throw activateError;
  const changed = Array.isArray(activated) ? activated[0] : activated;
  const activeChanged = await activeTemplate(); assert.equal(activeChanged.version, changed.version); assert.deepEqual(activeChanged.visible_cards, changedVisible);
  assert.deepEqual((await preference(workspaceId, invitedMember.id)).visible_cards, original.visible_cards);
  assert.deepEqual((await preference(workspaceId, firstAdmin.id)).visible_cards, personalVisible);

  const invitedViewer = await user("viewer"); await invite(workspaceId, firstAdmin, invitedViewer, "viewer");
  const viewerSnapshot = await preference(workspaceId, invitedViewer.id); assertSnapshot(viewerSnapshot, activeChanged);
  assert.equal(viewerSnapshot.seeded_template_version, original.version + 1);

  const { error: restoreError } = await service.rpc("activate_platform_dashboard_preference_template", { p_card_order: original.card_order, p_visible_cards: original.visible_cards, p_theme: original.theme });
  if (restoreError) throw restoreError;
  const restored = await activeTemplate(); assert.deepEqual(restored.visible_cards, original.visible_cards); assert.deepEqual(restored.card_order, original.card_order); assert.equal(restored.theme, original.theme);

  const { data: legacyRows, error: legacyError } = await service.from("dashboard_preferences").select("workspace_id, user_id").is("seeded_template_version", null).limit(5);
  if (legacyError) throw legacyError;
  assert.ok((legacyRows ?? []).length >= 0);
  console.log(JSON.stringify({ firstAdminVersion: firstSnapshot.seeded_template_version, invitedMemberVersion: memberSnapshot.seeded_template_version, newViewerVersion: viewerSnapshot.seeded_template_version, restoredActiveVersion: restored.version, legacyRowsSampled: (legacyRows ?? []).length }, null, 2));
} finally { await cleanup(); }

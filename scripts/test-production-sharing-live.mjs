// Intentionally opt-in: creates and removes synthetic fixtures only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
if (!process.argv.includes("--apply")) throw new Error("Pass --apply only after authorizing disposable live sharing validation.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || !anon) throw new Error("Supabase configuration is required.");
const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: schemaError } = await service.from("production_song_shares").select("id").limit(0);
if (schemaError) throw new Error("Apply the reviewed sharing migration before running live validation.");
const suffix = randomUUID().slice(0, 8), users = [], workspaces = [];
const songPositions = new Map();
async function user(label) {
  const email = `sharing-${label}-${suffix}@example.invalid`, password = `Test-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function workspace(label, admin) {
  const id = randomUUID(); workspaces.push(id);
  const { error } = await service.from("app_workspaces").insert({ id, slug: `sharing-${label}-${suffix}`, name: `sharing-${label}-${suffix}`, setup_state: "active", access_state: "active" });
  if (error) throw error;
  const membership = await service.from("app_workspace_members").insert({ workspace_id: id, user_id: admin.id, role: "admin" });
  if (membership.error) throw membership.error;
  return id;
}
async function rpc(name, args, succeeds = true) {
  const result = await service.rpc(name, args);
  if (succeeds && result.error) throw result.error;
  if (!succeeds) assert.ok(result.error, `Expected ${name} to reject unauthorized mutation`);
  return result.data;
}
async function shareFor(song) {
  const { data, error } = await service.from("production_song_shares").select("*").eq("production_song_id", song.id).maybeSingle();
  if (error) throw error; return data;
}
async function song(workspaceId, label) {
  const position = (songPositions.get(workspaceId) ?? 0) + 1;
  songPositions.set(workspaceId, position);
  const { data, error } = await service.from("production_songs").insert({ workspace_id: workspaceId, roadmap_general_position: position, slug: `sharing-${label}-${suffix}`, title: label, production_deadline: "2026-11-01", release_date: "2026-11-15" }).select("id, title").single();
  if (error) throw error; return data;
}
const origin = process.env.SHARING_TEST_ORIGIN ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "HTTP validation is restricted to localhost");
async function apiFor(account, activeWorkspaceId) {
  const cookies = new Map();
  const auth = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value))
    }
  });
  const { error } = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  return async (body, path = "/api/production/sharing", extraHeaders = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method: body ? "PATCH" : "GET",
      headers: {
        cookie: [...cookies, ["ls_active_workspace", activeWorkspaceId]].map(([name, value]) => `${name}=${value}`).join("; "),
        origin, "Content-Type": "application/json", ...extraHeaders
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, payload: await response.json() };
  };
}
try {
  const admin = await user("source-admin"), member = await user("common-member"), viewer = await user("recipient-viewer"), outsider = await user("outsider");
  const source = await workspace("source", admin), destination = await workspace("destination", member), unrelated = await workspace("unrelated", outsider);
  for (const membership of [{ workspace_id: source, user_id: member.id, role: "member" }, { workspace_id: destination, user_id: viewer.id, role: "viewer" }]) {
    const { error } = await service.from("app_workspace_members").insert(membership); if (error) throw error;
  }
  const set = (destinationId, extra = {}, actor = admin.id) => ({ p_workspace_id: source, p_actor: actor, p_destination: destinationId, ...extra });
  const original = await song(source, "existing-before-default");
  await rpc("set_production_song_sharing", set(unrelated, { p_is_default: true }), false);
  await rpc("set_production_song_sharing", set(destination, { p_is_default: true }, member.id), false);
  await rpc("set_production_song_sharing", set(destination, { p_is_default: true }), false);
  const retiredDefault = await service.from("production_song_sharing_defaults").insert({ workspace_id: source, destination_workspace_id: destination });
  if (retiredDefault.error) throw retiredDefault.error;
  assert.equal(await shareFor(original), null, "changing defaults must not share existing songs");
  const automatic = await song(source, "automatically-shared");
  assert.equal(await shareFor(automatic), null, "new songs remain unshared even with a retired default stored");
  await rpc("set_production_song_sharing", set(destination, { p_song_id: automatic.id }));
  const firstShare = await shareFor(automatic);
  assert.equal(firstShare.destination_workspace_id, destination);
  assert.equal(firstShare.source_workspace_id, source);
  await rpc("set_production_song_sharing", set(destination, { p_song_id: original.id }, member.id));
  await rpc("set_production_song_sharing", set(destination, { p_song_id: original.id }));

  const sourceApi = await apiFor(admin, source);
  const memberApi = await apiFor(member, source);
  const receiverApi = await apiFor(viewer, destination);
  let loaded = await sourceApi();
  assert.equal(loaded.status, 200, JSON.stringify(loaded.payload));
  assert.ok(loaded.payload.destinations.some((item) => item.id === destination));
  assert.ok(!loaded.payload.destinations.some((item) => item.id === unrelated));
  assert.ok(!Object.hasOwn(loaded.payload, "defaultDestinationId"));
  assert.equal((await memberApi()).payload.canManage, true);
  assert.equal((await memberApi({ action: "share", songId: original.id, destinationId: null })).status, 200);
  assert.equal(await shareFor(original), null);
  assert.equal((await memberApi({ action: "share", songId: original.id, destinationId: destination })).status, 200);
  loaded = await receiverApi();
  assert.equal(loaded.status, 200, JSON.stringify(loaded.payload));
  assert.equal(loaded.payload.incoming.length, 2);
  assert.equal(loaded.payload.canManage, false);
  assert.equal((await receiverApi({ action: "default", destinationId: source })).status, 400);
  const sourceEdit = await service.from("production_songs").update({ title: "Canonical linked update" }).eq("id", automatic.id);
  if (sourceEdit.error) throw sourceEdit.error;
  loaded = await receiverApi();
  assert.equal(loaded.payload.incoming.find((item) => item.song.id === automatic.id).song.title, "Canonical linked update");
  assert.equal((await receiverApi({ action: "remove-received", shareId: firstShare.id })).status, 200);
  assert.equal((await receiverApi()).payload.incoming.length, 1);
  assert.equal((await sourceApi({ action: "share", songId: automatic.id, destinationId: destination })).status, 200);
  const httpShare = await shareFor(automatic);
  assert.notEqual(httpShare.id, firstShare.id);
  assert.equal((await receiverApi({ action: "remove-received", shareId: firstShare.id })).status, 403);
  assert.equal((await receiverApi()).payload.incoming.length, 2);
  // Continue RPC validation with the current link identity.
  firstShare.id = httpShare.id;
  console.log("Local authenticated sharing API: eligibility, source permissions, canonical updates, Viewer removal and reshare passed.");

  const recipient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await recipient.auth.signInWithPassword({ email: viewer.email, password: viewer.password });
  if (signedIn.error) throw signedIn.error;
  const hiddenSource = await recipient.from("production_songs").select("id").eq("id", automatic.id);
  assert.ifError(hiddenSource.error);
  assert.deepEqual(hiddenSource.data, [], "sharing must not broaden canonical song RLS");
  const directMutation = await recipient.rpc("remove_received_production_song_share", { p_workspace_id: destination, p_actor: viewer.id, p_share_id: firstShare.id });
  assert.ok(directMutation.error, "clients cannot directly invoke service-only sharing RPCs");
  await rpc("remove_received_production_song_share", { p_workspace_id: destination, p_actor: outsider.id, p_share_id: firstShare.id }, false);
  await rpc("remove_received_production_song_share", { p_workspace_id: unrelated, p_actor: outsider.id, p_share_id: firstShare.id }, false);
  await rpc("remove_received_production_song_share", { p_workspace_id: destination, p_actor: viewer.id, p_share_id: firstShare.id });
  assert.equal(await shareFor(automatic), null);
  const updated = await service.from("production_songs").update({ title: "Edited original remains unshared" }).eq("id", automatic.id); if (updated.error) throw updated.error;
  assert.equal(await shareFor(automatic), null, "saving an existing song cannot reapply defaults");
  await rpc("set_production_song_sharing", set(destination, { p_song_id: automatic.id }));
  assert.notEqual((await shareFor(automatic)).id, firstShare.id, "explicit reshare makes a fresh link");
  await rpc("remove_received_production_song_share", { p_workspace_id: destination, p_actor: viewer.id, p_share_id: firstShare.id }, false);
  assert.ok(await shareFor(automatic), "a stale revoke cannot remove a new link");
  const canonical = await service.from("production_songs").select("title").eq("id", automatic.id).single();
  assert.equal(canonical.data.title, "Edited original remains unshared");
  const ownershipProbe = await song(unrelated, "ownership-probe");
  const mismatch = await service.from("production_song_shares").insert({ production_song_id: ownershipProbe.id, source_workspace_id: source, destination_workspace_id: destination });
  assert.ok(mismatch.error, "share ownership must match the canonical source");
  const removeMember = await service.from("app_workspace_members").delete().eq("workspace_id", source).eq("user_id", member.id); if (removeMember.error) throw removeMember.error;
  assert.equal(await rpc("production_share_destination_allowed", { p_source: source, p_destination: destination }), false);
  const noEligibleShare = await song(source, "no-common-member");
  assert.equal(await shareFor(noEligibleShare), null);
  await rpc("set_production_song_sharing", set(null, { p_is_default: true }), false);
  assert.equal(await shareFor(await song(source, "default-off")), null);
  console.log("Live sharing: no automatic defaults, explicit links, recipient removal, reshare, RLS, actor isolation, and lost-member eligibility passed.");
} finally {
  const cleanupErrors = [];
  for (const id of [...workspaces].reverse()) {
    try {
      const { error } = await service.from("app_workspaces").delete().eq("id", id);
      if (error) throw error;
    } catch (error) { cleanupErrors.push(`workspace ${id}: ${error.message}`); }
  }
  for (const id of users) {
    try {
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) throw error;
    } catch (error) { cleanupErrors.push(`user ${id}: ${error.message}`); }
  }
  if (cleanupErrors.length) throw new Error(`Fixture cleanup needs attention: ${cleanupErrors.join("; ")}`);
  if (workspaces.length) {
    const { data, error } = await service.from("app_workspaces").select("id").in("id", workspaces);
    if (error) throw error;
    assert.deepEqual(data, [], "all synthetic workspaces must be removed");
  }
  console.log(`Removed ${workspaces.length} disposable workspaces and ${users.length} disposable users.`);
}

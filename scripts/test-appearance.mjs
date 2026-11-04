import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function compile(path, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)((id) => dependencies[id] ?? require(id), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const appearance = compile("../lib/appearance.ts");
assert.equal(appearance.resolveTheme(undefined), "dark");
assert.equal(appearance.resolveTheme("light"), "light");
assert.equal(appearance.resolveTheme("system"), "dark");
assert.deepEqual(appearance.appearanceFromMetadata({ theme: "light" }), { theme: "dark", featureAcknowledged: false });
assert.deepEqual(appearance.appearanceFromMetadata({ artistdeck_theme: "light", artistdeck_dark_mode_v1_acknowledged: true }), { theme: "light", featureAcknowledged: true });
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
let authenticated = true;
let metadata = { unrelated_profile_value: "preserve" };
let writes = 0;
const route = compile("../app/api/user/appearance/route.ts", {
  "@/lib/appearance": appearance,
  "@/lib/server/workspace-owner": {
    WorkspaceAccessError: AccessError,
    requireAuthenticatedUser: async () => {
      if (!authenticated) throw new AccessError("Unauthorized", 401);
      return { id: "current-user", user_metadata: metadata };
    },
    createServiceSupabaseClient: () => ({ auth: { admin: { updateUserById: async (id, values) => {
      assert.equal(id, "current-user");
      writes++;
      metadata = { ...metadata, ...values.user_metadata };
      return { data: { user: { user_metadata: metadata } }, error: null };
    } } } })
  }
});
const { NextRequest } = require("next/server");
const request = (body, origin = "http://localhost:3000") => new NextRequest("http://localhost:3000/api/user/appearance", { method: "PATCH", headers: { origin, "content-type": "application/json", "x-love-strings-dashboard": "write" }, body: JSON.stringify(body) });
let result = await route.GET(new NextRequest("http://localhost:3000/api/user/appearance"));
assert.deepEqual(await result.json(), { theme: "dark", featureAcknowledged: false });
assert.match(result.headers.get("set-cookie"), /artistdeck-theme=dark/);
assert.match(result.headers.get("cache-control"), /private, no-store/);
for (const payload of [{ theme: "system" }, { acknowledgeFeature: false }, { userId: "other", theme: "light" }, {}, null, [], { theme: "dark", admin: true }]) {
  assert.equal((await route.PATCH(request(payload))).status, 400);
}
assert.equal((await route.PATCH(request({ theme: "light" }, "https://other.example"))).status, 403);
assert.equal(writes, 0);
result = await route.PATCH(request({ theme: "light" }));
assert.deepEqual(await result.json(), { theme: "light", featureAcknowledged: false });
result = await route.PATCH(request({ acknowledgeFeature: true }));
assert.deepEqual(await result.json(), { theme: "light", featureAcknowledged: true });
assert.equal(metadata.unrelated_profile_value, "preserve");
assert.equal(writes, 2);
authenticated = false;
assert.equal((await route.PATCH(request({ theme: "dark" }))).status, 401);
assert.equal(writes, 2);
console.log("Appearance defaults, account isolation, partial saves, acknowledgment, validation, and origin checks passed.");

// The personal endpoint must also work for Viewers and platform operators
// without membership; all other workspace routes retain their guards.
const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const priorAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
let proxyUser = { id: "viewer-or-operator" };
let membershipReads = 0;
const proxy = compile("../proxy.ts", {
  "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: proxyUser } }) }, from: () => { membershipReads++; throw new Error("Workspace guard reached"); } }) },
  "@/lib/workspace": { activeWorkspaceCookieName: "workspace", parseWorkspaceId: () => null, resolveWorkspaceMembership: () => null },
  "@/lib/platform-administration-routing": { isPlatformAdministrationPath: () => false }
});
assert.equal((await proxy.proxy(request({ theme: "light" }))).status, 200);
assert.equal(membershipReads, 0);
proxyUser = null;
assert.equal((await proxy.proxy(request({ theme: "light" }))).status, 401);
proxyUser = { id: "viewer-or-operator" };
await assert.rejects(proxy.proxy(new NextRequest("http://localhost:3000/api/events")), /Workspace guard reached/);
assert.equal(membershipReads, 1);
if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
if (priorAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = priorAnonKey;
console.log("Appearance proxy permits authenticated personal settings without weakening workspace guards.");

// Exercise the actual Viewer click guard: personal appearance is allowed,
// while an ordinary workspace mutation button is still blocked.
const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const clickGuard = pageSource.match(/  function preventViewerWriteClick[\s\S]*?(?=\n  function preventViewerWriteKeydown)/)?.[0];
assert.ok(clickGuard);
const compiledGuard = ts.transpileModule(clickGuard, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
class FakeElement {
  constructor(personal) { this.personal = personal; }
  closest(selector) { return selector === "[data-personal-appearance]" ? (this.personal ? this : null) : this; }
  matches() { return false; }
}
class FakeButton extends FakeElement {
  textContent = "Save workspace data";
  getAttribute() { return null; }
  hasAttribute() { return false; }
}
const guard = new Function("Element", "HTMLButtonElement", "workspaceRole", "settingsView", `${compiledGuard}; return preventViewerWriteClick;`)(FakeElement, FakeButton, "viewer", null);
for (const personal of [false, true]) {
  let prevented = false, stopped = false;
  guard({ target: new FakeButton(personal), preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
  assert.equal(prevented, !personal);
  assert.equal(stopped, !personal);
}
const featureSource = readFileSync(new URL("../app/components/dark-mode-feature.tsx", import.meta.url), "utf8");
assert.match(featureSource, /<aside data-personal-appearance/);
console.log("Viewer click guard permits personal appearance controls and still blocks workspace mutations.");

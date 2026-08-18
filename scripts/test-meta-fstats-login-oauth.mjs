import assert from "node:assert/strict";

process.env.META_FSTATS_APP_ID = "1601779391517352";
process.env.META_FSTATS_APP_SECRET = "test-secret-not-a-real-secret";
process.env.META_FSTATS_CONFIG_ID = "1034329012852736";

const { hasRequiredMetaScopes, requiredMetaScopes } = await import("../lib/meta/scopes.ts");
const { createFstatsLoginAuthorizationUrl, getFstatsLoginRedirectUri } = await import("../lib/meta/fstats-login-oauth.ts");

const callbackForOrigin = (origin) => {
  if (origin === "https://love-strings-dashboard.vercel.app" || origin === "http://localhost:3000") return `${origin}/api/integrations/meta/fstats-login/callback`;
  throw new Error("Meta Facebook Login is not configured for this app origin.");
};
const fstatsLoginRedirectUri = callbackForOrigin("https://love-strings-dashboard.vercel.app");
assert.equal(callbackForOrigin("http://localhost:3000"), "http://localhost:3000/api/integrations/meta/fstats-login/callback");
assert.throws(() => callbackForOrigin("http://localhost:3001"));
assert.throws(() => callbackForOrigin("https://evil.example"));
const normalizeGrantedScopes = (value) => !Array.isArray(value) ? [] : Array.from(new Set(value.flatMap((entry) => {
  if (!entry || typeof entry !== "object") return [];
  return entry.status === "granted" && typeof entry.permission === "string" && entry.permission ? [entry.permission] : [];
}))).sort();
const normalizeFacebookPages = (value) => {
  if (!Array.isArray(value)) return [];
  const pages = new Map();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id || typeof entry.name !== "string" || !entry.name.trim()) continue;
    pages.set(entry.id, { externalId: entry.id, displayName: entry.name.trim() });
  }
  return [...pages.values()];
};
assert.equal(getFstatsLoginRedirectUri("http://localhost:3000"), "http://localhost:3000/api/integrations/meta/fstats-login/callback");
const authorizationUrl = createFstatsLoginAuthorizationUrl({ redirectUri: fstatsLoginRedirectUri, state: "state-test-value" });
assert.equal(authorizationUrl.origin, "https://www.facebook.com");
assert.equal(authorizationUrl.pathname, "/v23.0/dialog/oauth");
assert.equal(authorizationUrl.searchParams.get("redirect_uri"), fstatsLoginRedirectUri);
assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
assert.equal(authorizationUrl.searchParams.get("state"), "state-test-value");
assert.equal(authorizationUrl.searchParams.get("config_id"), "1034329012852736");
assert.equal(authorizationUrl.searchParams.has("scope"), false, "config_id owns the requested permissions");
assert.equal(requiredMetaScopes.fstats_login_facebook_page.includes("business_management"), true, "App B validates the business-linked Page discovery permission returned by its configuration");
const priorConfigId = process.env.META_FSTATS_CONFIG_ID;
delete process.env.META_FSTATS_CONFIG_ID;
assert.throws(() => createFstatsLoginAuthorizationUrl({ redirectUri: fstatsLoginRedirectUri, state: "state-test-value" }), /META_FSTATS_CONFIG_ID/);
process.env.META_FSTATS_CONFIG_ID = priorConfigId;

const granted = normalizeGrantedScopes([
  { permission: "read_insights", status: "granted" },
  { permission: "pages_show_list", status: "declined" },
  { permission: "read_insights", status: "granted" },
  { permission: 7, status: "granted" },
  null
]);
assert.deepEqual(granted, ["read_insights"]);
assert.equal(hasRequiredMetaScopes("fstats_login_facebook_page", granted), false, "missing grants cannot be healthy");
assert.equal(hasRequiredMetaScopes("fstats_login_facebook_page", [...requiredMetaScopes.fstats_login_facebook_page]), true);

const pages = normalizeFacebookPages([
  { id: "page-1", name: "First name" },
  { id: "page-1", name: "Renamed page" },
  { id: "page-2", name: "  Second page  " },
  { id: "", name: "Invalid" },
  { id: "page-3" },
  "invalid",
  null
]);
assert.deepEqual(pages, [
  { externalId: "page-1", displayName: "Renamed page" },
  { externalId: "page-2", displayName: "Second page" }
], "Page ID, not display name, is the dedupe key");
assert.deepEqual(normalizeFacebookPages({ data: [] }), [], "malformed Page payload is safe");
assert.deepEqual(normalizeGrantedScopes({ data: [] }), [], "malformed permission payload is safe");

console.log("Meta FStats Login OAuth helper tests passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
process.env.APP_CANONICAL_ORIGIN = "https://www.artistdeck.app";
const appOrigin = "https://www.artistdeck.app";
const callbackOrigin = "https://love-strings-dashboard.vercel.app";
function load(path, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => name in mocks ? mocks[name] : require(name), URL, process, console, Date, Set });
  return exports;
}
const origins = load("lib/oauth-attempt.ts");
const request = (url) => ({ nextUrl: new URL(url), cookies: { get() { throw new Error("Cross-domain callback must not depend on cookies"); } } });
const NextResponse = { redirect: (url) => ({ location: new URL(url), status: 307 }), json: (body, options) => ({ body, status: options.status }) };
class OAuthAttemptError extends Error {}
let attempt, consumed, writes = [], tokenCalls = 0, service = "youtube", guidance = false;
const serviceClient = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }), upsert: async (row) => { writes.push(row); return {}; } }; } };
const attempts = {
  OAuthAttemptError,
  async createFixedCallbackOAuthAttempt(input) {
    assert.equal(input.userId, "user-a"); assert.equal(input.workspaceId, "workspace-a");
    origins.getAllowedOAuthReturnOrigin(input.origin);
    attempt = { returnOrigin: input.origin, returnPath: input.returnTarget, userId: input.userId, workspaceId: input.workspaceId, context: input.context ?? {}, kind: input.integrationKind };
    consumed = false; return { state: "random-one-time-state" };
  },
  async consumeFixedCallbackOAuthAttempt(input) {
    if (!attempt || consumed || input.state !== "random-one-time-state" || input.expectedIntegrationKind !== attempt.kind) throw new OAuthAttemptError();
    consumed = true; return attempt;
  }
};
const google = {
  isGoogleService: (value) => ["youtube", "analytics"].includes(value),
  createGoogleAuthorizationUrl(input) { assert.equal(input.redirectUri, `${callbackOrigin}/api/integrations/google/callback`); return `https://accounts.google.com/?state=${input.state}`; },
  async exchangeGoogleAuthorizationCode(code, uri) { tokenCalls++; assert.equal(code, "provider-code"); assert.equal(uri, `${callbackOrigin}/api/integrations/google/callback`); return { access_token: "access", refresh_token: "refresh" }; },
  encryptGoogleRefreshToken: () => "encrypted",
  async fetchGoogleJson(token, url) {
    if (url.includes("userinfo")) return { email: "test@example.test", sub: "subject" };
    if (url.includes("channels")) return { items: [{ id: "channel-a", snippet: { title: "Channel" } }] };
    if (url.includes("accountSummaries")) return { accountSummaries: [{ propertySummaries: [{ property: "properties/123", displayName: "Web" }] }] };
    return { dataStreams: [] };
  }
};
const mocks = {
  "next/server": { NextResponse }, "@/lib/oauth-attempt": origins,
  "@/lib/google/oauth": google, "@/lib/server/oauth-attempts": attempts,
  "@/lib/server/workspace-owner": { requireWorkspaceAdministrator: async () => ({ serviceClient, user: { id: "user-a" }, workspaceId: "workspace-a" }), createServiceSupabaseClient: () => serviceClient, WorkspaceAccessError: class extends Error {} },
  "@/lib/server/platform-accounts": { reconcilePlatformAccount: async () => {} },
  "@/lib/metrics/post-connection-collection": { collectAfterConnection: async () => {} }
};
const connect = load("app/api/integrations/google/connect/route.ts", mocks);
const callback = load("app/api/integrations/google/callback/route.ts", mocks);
for (service of ["youtube", "analytics"]) {
  for (guidance of [false, true]) {
    await connect.GET(request(`${appOrigin}/api/integrations/google/connect?service=${service}&guidance=${Number(guidance)}`));
    const before = tokenCalls;
    const invalid = await callback.GET(request(`${callbackOrigin}/api/integrations/google/callback?state=wrong&code=provider-code`));
    assert.equal(invalid.status, 400); assert.equal(tokenCalls, before);
    const response = await callback.GET(request(`${callbackOrigin}/api/integrations/google/callback?state=random-one-time-state&code=provider-code`));
    assert.equal(response.location.origin, appOrigin);
    assert.equal(response.location.searchParams.get("google"), "connected");
    assert.equal(response.location.searchParams.has("guidance_return"), guidance);
    assert.equal(writes.at(-1).workspace_id, "workspace-a"); assert.equal(writes.at(-1).connected_by, "user-a");
    const replay = await callback.GET(request(`${callbackOrigin}/api/integrations/google/callback?state=random-one-time-state&code=provider-code`));
    assert.equal(replay.status, 400); assert.equal(tokenCalls, before + 1);
  }
}
await connect.GET(request(`${appOrigin}/api/integrations/google/connect?service=youtube`));
const before = tokenCalls;
const denied = await callback.GET(request(`${callbackOrigin}/api/integrations/google/callback?state=random-one-time-state&error=access_denied`));
assert.equal(denied.location.origin, appOrigin); assert.equal(denied.location.searchParams.get("google"), "error"); assert.equal(tokenCalls, before);
const facebookOauth = load("lib/meta/fstats-login-oauth.ts");
let facebookWrites = 0;
const facebookMocks = {
  ...mocks,
  "@/lib/meta/fstats-login-oauth": {
    ...facebookOauth,
    createFstatsLoginAuthorizationUrl({ redirectUri, state }) { assert.equal(redirectUri, `${callbackOrigin}/api/integrations/meta/fstats-login/callback`); return `https://www.facebook.com/?state=${state}`; },
    async exchangeFstatsLoginAuthorizationCode(code, uri) { assert.equal(uri, `${callbackOrigin}/api/integrations/meta/fstats-login/callback`); return { accessToken: "access" }; },
    fetchFstatsLoginAuthorizationUserId: async () => "facebook-user",
    fetchFstatsLoginGrantedScopes: async () => [],
    discoverFstatsLoginFacebookPages: async () => []
  },
  "@/lib/meta/tokens": { encryptMetaTokenPayload: () => "encrypted" },
  "@/lib/server/meta-connections": {
    async saveMetaConnection(client, input) { assert.equal(input.workspaceId, "workspace-a"); assert.equal(input.connectedBy, "user-a"); facebookWrites++; return { id: "connection-a" }; },
    saveMetaFacebookPageCandidates: async () => {}
  },
  "@/lib/server/meta-fstats-discovery": { runLinkedInstagramDiscovery: async () => {} },
  "@/lib/server/meta-fstats-state": { readAuthoritativeFstatsLoginState: async () => ({}) }
};
const facebookConnect = load("app/api/integrations/meta/fstats-login/connect/route.ts", facebookMocks);
const facebookCallback = load("app/api/integrations/meta/fstats-login/callback/route.ts", facebookMocks);
await facebookConnect.GET(request(`${appOrigin}/api/integrations/meta/fstats-login/connect?return=/?settings=general`));
const fbRequest = request(`${callbackOrigin}/api/integrations/meta/fstats-login/callback?state=random-one-time-state&code=provider-code`);
const fbResponse = await facebookCallback.GET(fbRequest);
assert.equal(fbResponse.location.origin, appOrigin);
assert.equal(fbResponse.location.searchParams.get("meta"), "fstats-login-selection-required");
assert.equal(facebookWrites, 1);
assert.equal((await facebookCallback.GET(fbRequest)).status, 400);
assert.equal(facebookWrites, 1);
await facebookConnect.GET(request(`${appOrigin}/api/integrations/meta/fstats-login/connect`));
const fbDenied = await facebookCallback.GET(request(`${callbackOrigin}/api/integrations/meta/fstats-login/callback?state=random-one-time-state&error=access_denied`));
assert.equal(fbDenied.location.origin, appOrigin);
assert.equal(fbDenied.location.searchParams.get("meta"), "fstats-login-error");
assert.equal(facebookWrites, 1);
// Actual fixed-attempt helper passes all binding/expiry checks through the RPC.
const serverSource = readFileSync(new URL("../lib/server/oauth-attempts.ts", import.meta.url), "utf8");
assert.match(serverSource, /context,\s*return_origin: returnOrigin/);
const sql = readFileSync(new URL("../supabase/migrations/202611040001_allow_artistdeck_oauth_return_origin.sql", import.meta.url), "utf8");
for (const check of [/for update/, /consumed_at is not null/, /expires_at <= now\(\)/, /integration_kind <> p_integration_kind/, /membership.user_id = attempt.user_id/, /membership.role = 'admin'/, /revoke all.*from authenticated/, /grant execute.*to service_role/]) assert.match(sql, check);
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
for (const path of ["google", "meta/fstats-login", "meta/instagram", "meta/threads"]) assert.ok(proxy.includes(`pathname === "/api/integrations/${path}/callback"`));
for (const name of ["instagram", "threads"]) {
  const oauthModule = load(`lib/meta/${name}-oauth.ts`, { "@/lib/oauth-attempt": origins });
  const getter = name === "instagram" ? oauthModule.getCreatorSocialInstagramRedirectUri : oauthModule.getCreatorSocialThreadsRedirectUri;
  assert.equal(getter(), `${callbackOrigin}/api/integrations/meta/${name}/callback`);
}
console.log("Custom-domain OAuth: Google/Facebook cross-domain routes, guided/ordinary returns, both services, denial, invalid/replayed state, Creator callbacks and SQL guards passed (mocked providers/database).");

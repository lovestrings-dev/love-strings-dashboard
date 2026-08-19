import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const oauth = await readFile(new URL("../lib/meta/threads-oauth.ts", import.meta.url), "utf8");
const connect = await readFile(new URL("../app/api/integrations/meta/threads/connect/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/integrations/meta/threads/callback/route.ts", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../app/api/integrations/meta/threads/route.ts", import.meta.url), "utf8");
const connections = await readFile(new URL("../lib/server/meta-connections.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/202608190007_bind_creator_social_threads.sql", import.meta.url), "utf8");
const stateSource = (await readFile(new URL("../lib/meta/creator-threads-state.ts", import.meta.url), "utf8"));
const { resolveCreatorSocialThreadsState } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(stateSource, { mode: "strip" })).toString("base64")}`);

assert.match(oauth, /https:\/\/threads\.net\/oauth\/authorize/);
assert.match(oauth, /https:\/\/graph\.threads\.net\/oauth\/access_token/);
assert.match(oauth, /https:\/\/graph\.threads\.net\/access_token/);
assert.match(oauth, /th_exchange_token/);
assert.match(oauth, /https:\/\/graph\.threads\.net\/v1\.0\/me/);
assert.match(oauth, /threads_basic.*threads_manage_insights/s);
assert.match(oauth, /\/api\/integrations\/meta\/threads\/callback/);
assert.match(oauth, /META_CREATOR_SOCIAL_THREADS_APP_ID/);
assert.match(oauth, /META_CREATOR_SOCIAL_THREADS_APP_SECRET/);
assert.doesNotMatch(oauth, /META_CREATOR_SOCIAL_APP_(?:ID|SECRET)/);
assert.doesNotMatch(oauth, /console\.(?:info|error).*accessToken/);

assert.match(connect, /requireWorkspaceAdministrator/);
assert.match(connect, /createFixedCallbackOAuthAttempt/);
assert.match(connect, /creatorSocialThreadsIntegrationKind/);
assert.match(callback, /consumeFixedCallbackOAuthAttempt/);
assert.match(callback, /expectedIntegrationKind: creatorSocialThreadsIntegrationKind/);
assert.match(callback, /exchangeCreatorSocialThreadsCode/);
assert.match(callback, /fetchCreatorSocialThreadsIdentity/);
assert.match(callback, /encryptMetaTokenPayload/);
assert.match(callback, /createOAuthResultReturnUrl/);
assert.doesNotMatch(callback, /console\.(?:info|error).*searchParams\.get\("code"/);
assert.doesNotMatch(callback, /searchParams\.set\([^)]*(?:code|token|state)/);
assert.match(endpoint, /readCreatorSocialThreadsState/);
assert.match(endpoint, /disconnect_creator_social_threads/);
assert.match(endpoint, /requireWorkspaceAdministrator/);

assert.match(connections, /bindCreatorSocialThreads/);
assert.match(connections, /readCreatorSocialThreadsState/);
assert.match(connections, /creator_social_threads/);
assert.match(migration, /create function public\.bind_creator_social_threads/);
assert.match(migration, /create function public\.disconnect_creator_social_threads/);
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('threads:'/);
assert.match(migration, /connection_kind = 'creator_social_threads'/);
assert.doesNotMatch(migration, /creator_social_instagram/);
assert.doesNotMatch(migration, /fstats_login_facebook_page/);
assert.match(migration, /platform_id, meta_external_id/);
assert.match(migration, /on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key/);

assert.deepEqual(resolveCreatorSocialThreadsState([]), { state: "disconnected" });
assert.deepEqual(resolveCreatorSocialThreadsState([
  { id: "old", connection_state: "no_data", token_expires_at: null, app_meta_connection_accounts: [] },
  { id: "active", connection_state: "connected", token_expires_at: "2026-10-19T00:00:00Z", app_meta_connection_accounts: [{ account_type: "threads_profile", is_selected: true, platform_accounts: { meta_external_id: "threads-1", account_name: "@lovestrings", url: "https://www.threads.com/@lovestrings" } }] }
]), { state: "connected", connectionId: "active", tokenExpiresAt: "2026-10-19T00:00:00Z", account: { externalId: "threads-1", displayName: "@lovestrings", url: "https://www.threads.com/@lovestrings" } });
assert.deepEqual(resolveCreatorSocialThreadsState([
  { id: "inactive", connection_state: "no_data", token_expires_at: null, app_meta_connection_accounts: [] }
]), { state: "degraded", connectionId: "inactive", account: undefined });

console.log("Meta creator Threads OAuth/binding tests passed.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveCreatorSocialInstagramState } from "../lib/meta/creator-instagram-state.ts";

const connect = await readFile(new URL("../app/api/integrations/meta/instagram/connect/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/integrations/meta/instagram/callback/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/202608190002_bind_creator_social_instagram.sql", import.meta.url), "utf8");
const standaloneBindingMigration = await readFile(new URL("../supabase/migrations/202608190003_allow_standalone_instagram_active_binding.sql", import.meta.url), "utf8");
const ambiguityFixMigration = await readFile(new URL("../supabase/migrations/202608190004_fix_creator_social_instagram_connection_id_ambiguity.sql", import.meta.url), "utf8");
const reconnectFixMigration = await readFile(new URL("../supabase/migrations/202608190005_preserve_creator_instagram_reconnect_state.sql", import.meta.url), "utf8");
const oauth = await readFile(new URL("../lib/meta/instagram-oauth.ts", import.meta.url), "utf8");
const connections = await readFile(new URL("../lib/server/meta-connections.ts", import.meta.url), "utf8");
assert.match(oauth, /https:\/\/www\.instagram\.com\/oauth\/authorize/);
assert.match(oauth, /https:\/\/api\.instagram\.com\/oauth\/access_token/);
assert.match(oauth, /https:\/\/graph\.instagram\.com\/access_token/);
assert.match(oauth, /instagram_business_basic.*instagram_business_manage_insights/s);
assert.match(oauth, /\/api\/integrations\/meta\/instagram\/callback/);
assert.match(oauth, /instagram-app-id-present/);
assert.match(oauth, /instagram-app-secret-present/);
assert.match(oauth, /token-exchange-fetch-start/);
assert.match(oauth, /token-exchange-response-received/);
assert.match(oauth, /callback-uri-resolved/);
assert.doesNotMatch(oauth, /console\.(?:info|error).*accessToken/);
assert.match(callback, /callback-entered/);
assert.match(callback, /oauth-attempt-consumed/);
assert.match(callback, /provider-code-present/);
assert.match(callback, /instagram-oauth-callback-failed/);
assert.doesNotMatch(callback, /console\.(?:info|error).*searchParams\.get\("code"/);
assert.match(connections, /platform_accounts!app_meta_connection_accounts_platform_account_id_fkey!inner/);
assert.match(connect, /requireWorkspaceAdministrator/);
assert.match(connect, /createFixedCallbackOAuthAttempt/);
assert.match(connect, /creatorSocialInstagramIntegrationKind/);
assert.match(callback, /consumeFixedCallbackOAuthAttempt/);
assert.match(callback, /expectedIntegrationKind: creatorSocialInstagramIntegrationKind/);
assert.match(callback, /exchangeCreatorSocialInstagramCode/);
assert.match(callback, /encryptMetaTokenPayload/);
assert.match(callback, /createOAuthResultReturnUrl/);
assert.doesNotMatch(callback, /searchParams\.set\([^)]*(?:code|token)/);
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('instagram:'/);
assert.match(migration, /connection\.connection_kind = 'fstats_login_facebook_page'/);
assert.match(migration, /errcode = 'P2101'/);
assert.match(migration, /connection_kind = 'creator_social_instagram'/);
assert.match(migration, /connection_state = 'no_data'/);
assert.match(migration, /disconnect_creator_social_instagram/);
assert.match(standaloneBindingMigration, /parent_page_external_id drop not null/);
assert.match(ambiguityFixMigration, /on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key/);
assert.doesNotMatch(ambiguityFixMigration, /on conflict \(connection_id, platform_account_id\)/);
assert.match(ambiguityFixMigration, /return query select v_connection_id, v_account_id/);
assert.match(ambiguityFixMigration, /errcode = 'P2101'/);
assert.match(reconnectFixMigration, /v_connection_id uuid/);
assert.match(reconnectFixMigration, /Prefer the currently active App A binding/);
assert.match(reconnectFixMigration, /connection\.id <> v_connection_id/);
assert.match(reconnectFixMigration, /Make the replacement mapping valid first/);
assert.match(reconnectFixMigration, /on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key/);
assert.match(reconnectFixMigration, /return query select v_connection_id, v_account_id/);
assert.doesNotMatch(connections, /\.limit\(1\)\.maybeSingle\(\)/);
assert.match(connections, /resolveCreatorSocialInstagramState/);
assert.deepEqual(resolveCreatorSocialInstagramState([]), { state: "disconnected" });
assert.deepEqual(resolveCreatorSocialInstagramState([
  { id: "old", connection_state: "no_data", token_expires_at: null, app_meta_connection_accounts: [{ account_type: "instagram_professional", is_selected: false, platform_accounts: { meta_external_id: "old", account_name: "Old", url: null } }] },
  { id: "active", connection_state: "connected", token_expires_at: "2026-10-19T00:00:00Z", app_meta_connection_accounts: [{ account_type: "instagram_professional", is_selected: true, platform_accounts: { meta_external_id: "active", account_name: "Active", url: null } }] }
]), { state: "connected", connectionId: "active", tokenExpiresAt: "2026-10-19T00:00:00Z", account: { externalId: "active", displayName: "Active", url: null } });
assert.deepEqual(resolveCreatorSocialInstagramState([
  { id: "degraded", connection_state: "no_data", token_expires_at: null, app_meta_connection_accounts: [] }
]), { state: "degraded", connectionId: "degraded", account: undefined });
console.log("Meta creator Instagram OAuth/binding tests passed.");

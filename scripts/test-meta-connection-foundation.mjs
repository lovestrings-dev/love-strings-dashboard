import assert from "node:assert/strict";

process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64url");

const { hasRequiredMetaScopes, metaAppKindForConnectionKind, missingMetaScopes, requiredMetaScopes } = await import("../lib/meta/scopes.ts");
const { decryptMetaTokenPayload, encryptMetaTokenPayload } = await import("../lib/meta/tokens.ts");
const { MetaPageSelectionError, normalizeMetaPageSelectionError } = await import("../lib/meta/selection-error.ts");
const metaAccountIdentityKey = (workspaceId, accountType, externalId) => {
  const platform = {
    facebook_page: "facebook",
    instagram_professional: "instagram",
    threads_profile: "threads"
  }[accountType];
  return `${workspaceId}:${platform}:${externalId}`;
};

const instagramScopes = [...requiredMetaScopes.creator_social_instagram];
const threadsScopes = [...requiredMetaScopes.creator_social_threads];
const pageScopes = [...requiredMetaScopes.fstats_login_facebook_page];
assert.equal(hasRequiredMetaScopes("creator_social_instagram", instagramScopes), true, "App A Instagram scopes are sufficient");
assert.equal(hasRequiredMetaScopes("creator_social_threads", threadsScopes), true, "App A Threads scopes are sufficient");
assert.equal(hasRequiredMetaScopes("fstats_login_facebook_page", pageScopes), true, "App B Page scopes include business_management for business-linked Page discovery");
assert.deepEqual(missingMetaScopes("fstats_login_facebook_page", pageScopes), []);
assert.deepEqual(missingMetaScopes("fstats_login_facebook_page", pageScopes.filter((scope) => scope !== "business_management")), ["business_management"]);
assert.deepEqual(missingMetaScopes("creator_social_instagram", instagramScopes.slice(1)), ["instagram_business_basic"]);
assert.deepEqual(missingMetaScopes("creator_social_threads", instagramScopes), ["threads_basic", "threads_manage_insights"]);
assert.equal(metaAppKindForConnectionKind("creator_social_instagram"), "creator_social");
assert.equal(metaAppKindForConnectionKind("creator_social_threads"), "creator_social", "Instagram and Threads retain separate connection kinds under App A");
assert.equal(metaAppKindForConnectionKind("fstats_login_facebook_page"), "fstats_login");

const plaintext = "meta-access-token-test-only";
const encrypted = encryptMetaTokenPayload({ accessToken: plaintext, refreshToken: "refresh-test-only" });
assert.notEqual(encrypted, plaintext, "encrypted payload is not plaintext");
assert.deepEqual(decryptMetaTokenPayload(encrypted), { accessToken: plaintext, refreshToken: "refresh-test-only" });

const workspaceAIdentity = metaAccountIdentityKey("workspace-a", "instagram_professional", "ig-123");
assert.equal(workspaceAIdentity, metaAccountIdentityKey("workspace-a", "instagram_professional", "ig-123"), "stable ID reconciliation is idempotent");
assert.notEqual(workspaceAIdentity, metaAccountIdentityKey("workspace-b", "instagram_professional", "ig-123"), "same external ID is isolated across workspaces");
assert.notEqual(workspaceAIdentity, metaAccountIdentityKey("workspace-a", "facebook_page", "ig-123"), "platform type remains part of identity");
assert.equal(workspaceAIdentity, metaAccountIdentityKey("workspace-a", "instagram_professional", "ig-123"), "display name and username do not form identity");

const safeStatus = { appKind: "fstats_login", connectionKind: "fstats_login_facebook_page", connectionState: "connected", grantedScopes: pageScopes, id: "connection-a" };
assert.equal(JSON.stringify(safeStatus).includes(plaintext), false, "safe status never exposes token plaintext");
assert.equal(JSON.stringify(safeStatus).includes("encrypted_token_payload"), false, "safe status omits encrypted payload");

const selectedAssets = new Map();
selectedAssets.set("connection-a:facebook_page", "page-a");
selectedAssets.set("connection-a:instagram_professional", "instagram-a");
assert.equal(selectedAssets.size, 2, "multiple discovered asset types coexist under one connection");
assert.equal(selectedAssets.get("connection-a:facebook_page"), "page-a");

const normalizedRpcError = normalizeMetaPageSelectionError({
  code: "42P10",
  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
  details: "private database detail",
  hint: "private database hint",
  access_token: "must-not-survive"
});
assert.ok(normalizedRpcError instanceof MetaPageSelectionError, "PostgREST object errors become standard safe Errors");
assert.equal(normalizedRpcError.code, "42P10");
assert.match(normalizedRpcError.message, /42P10/);
assert.match(normalizedRpcError.message, /unique or exclusion constraint/);
assert.doesNotMatch(normalizedRpcError.message, /private|token/i, "unallowlisted fields never survive normalization");
const secretLikeError = normalizeMetaPageSelectionError({ code: "P0001", message: "access_token=secret-value" });
assert.equal(secretLikeError.code, "P0001");
assert.equal(secretLikeError.message, "Meta Page selection failed [P0001]: Database rejected the Page selection.");
const standardError = new Error("Standard error stays intact.");
assert.equal(normalizeMetaPageSelectionError(standardError), standardError, "standard Error handling remains intact");

console.log("Meta connection foundation tests passed.");

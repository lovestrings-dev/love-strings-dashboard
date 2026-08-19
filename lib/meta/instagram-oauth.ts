import { getCanonicalOAuthOrigin } from "@/lib/oauth-attempt";

export const creatorSocialInstagramConnectionKind = "creator_social_instagram";
export const creatorSocialInstagramIntegrationKind = "meta:creator-social-instagram";
export const creatorSocialInstagramScopes = ["instagram_business_basic", "instagram_business_manage_insights"] as const;
const callbackPath = "/api/integrations/meta/instagram/callback";

type TokenPayload = { access_token?: unknown; expires_in?: unknown; token_type?: unknown; user_id?: unknown; permissions?: unknown; data?: unknown };
export type CreatorSocialInstagramOAuthStage =
  | "callback-uri-resolved" | "instagram-app-id-present" | "instagram-app-secret-present"
  | "token-exchange-request-prepared" | "token-exchange-fetch-start" | "token-exchange-response-received"
  | "long-lived-exchange-start" | "identity-request-start";
type StageReporter = (stage: CreatorSocialInstagramOAuthStage, details?: { status?: number }) => void;

export function getCreatorSocialInstagramRedirectUri() {
  return new URL(callbackPath, getCanonicalOAuthOrigin()).toString();
}

export function createCreatorSocialInstagramAuthorizationUrl(state: string) {
  if (!state) throw new Error("OAuth authorization state is required.");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", getInstagramAppId());
  url.searchParams.set("redirect_uri", getCreatorSocialInstagramRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", creatorSocialInstagramScopes.join(","));
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeCreatorSocialInstagramCode(code: string, reportStage?: StageReporter) {
  if (!code) throw new Error("Instagram authorization code is missing.");
  const appId = getInstagramAppId();
  reportStage?.("instagram-app-id-present");
  const appSecret = getInstagramAppSecret();
  reportStage?.("instagram-app-secret-present");
  const redirectUri = getCreatorSocialInstagramRedirectUri();
  reportStage?.("callback-uri-resolved");
  const form = new FormData();
  form.set("client_id", appId);
  form.set("client_secret", appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);
  reportStage?.("token-exchange-request-prepared");
  reportStage?.("token-exchange-fetch-start");
  const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, cache: "no-store" });
  reportStage?.("token-exchange-response-received", { status: shortResponse.status });
  const payload = await readJson<TokenPayload>(shortResponse);
  const shortToken = firstToken(payload);
  if (!shortToken) throw new Error("Instagram authorization code exchange failed.");
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken.accessToken);
  reportStage?.("long-lived-exchange-start");
  const longPayload = await readJson<TokenPayload>(await fetch(url, { cache: "no-store" }));
  const longToken = firstToken(longPayload);
  if (!longToken) throw new Error("Instagram long-lived token exchange failed.");
  return { accessToken: longToken.accessToken, expiresInSeconds: positiveNumber(longToken.expiresIn), tokenType: longToken.tokenType, userId: shortToken.userId, grantedScopes: grantedPermissions(payload) };
}

export async function fetchCreatorSocialInstagramIdentity(accessToken: string, reportStage?: StageReporter) {
  const url = new URL("https://graph.instagram.com/v25.0/me");
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", accessToken);
  reportStage?.("identity-request-start");
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson<Record<string, unknown>>(response);
  if (!response.ok || typeof payload.id !== "string" || !payload.id) throw new Error("Instagram professional identity could not be verified.");
  const username = typeof payload.username === "string" && payload.username.trim() ? payload.username.trim() : null;
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  return { externalId: payload.id, username, displayName: username ?? name ?? `Instagram ${payload.id}` };
}

function firstToken(payload: TokenPayload) {
  const value = Array.isArray(payload.data) ? payload.data[0] : payload;
  if (!value || typeof value !== "object") return null;
  const record = value as TokenPayload;
  return typeof record.access_token === "string" && record.access_token
    ? { accessToken: record.access_token, expiresIn: record.expires_in, tokenType: typeof record.token_type === "string" && record.token_type ? record.token_type : "bearer", userId: stableId(record.user_id) }
    : null;
}
function stableId(value: unknown) {
  if (typeof value === "string" && value) return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}
function grantedPermissions(payload: TokenPayload) {
  const root = Array.isArray(payload.data) ? payload.data[0] : payload;
  const permissions = root && typeof root === "object" ? (root as TokenPayload).permissions : null;
  return typeof permissions === "string" ? permissions.split(",").map((value) => value.trim()).filter(Boolean) : [...creatorSocialInstagramScopes];
}
async function readJson<T>(response: Response) { try { return await response.json() as T; } catch { return {} as T; } }
function positiveNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null; }
function getInstagramAppId() { const value = process.env.META_CREATOR_SOCIAL_INSTAGRAM_APP_ID; if (!value) throw new Error("META_CREATOR_SOCIAL_INSTAGRAM_APP_ID is not configured."); return value; }
function getInstagramAppSecret() { const value = process.env.META_CREATOR_SOCIAL_INSTAGRAM_APP_SECRET; if (!value) throw new Error("META_CREATOR_SOCIAL_INSTAGRAM_APP_SECRET is not configured."); return value; }

import { getCanonicalOAuthOrigin } from "@/lib/oauth-attempt";

export const creatorSocialThreadsConnectionKind = "creator_social_threads";
export const creatorSocialThreadsIntegrationKind = "meta:creator-social-threads";
export const creatorSocialThreadsScopes = ["threads_basic", "threads_manage_insights"] as const;

const callbackPath = "/api/integrations/meta/threads/callback";

type TokenPayload = {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  user_id?: unknown;
  permissions?: unknown;
  data?: unknown;
};

export type CreatorSocialThreadsOAuthStage =
  | "callback-uri-resolved"
  | "threads-app-id-present"
  | "threads-app-secret-present"
  | "token-exchange-request-prepared"
  | "token-exchange-fetch-start"
  | "token-exchange-response-received"
  | "long-lived-exchange-start"
  | "identity-request-start";

type StageReporter = (stage: CreatorSocialThreadsOAuthStage, details?: { status?: number }) => void;

export function getCreatorSocialThreadsRedirectUri() {
  return new URL(callbackPath, getCanonicalOAuthOrigin()).toString();
}

export function createCreatorSocialThreadsAuthorizationUrl(state: string) {
  if (!state) throw new Error("OAuth authorization state is required.");
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", getThreadsAppId());
  url.searchParams.set("redirect_uri", getCreatorSocialThreadsRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", creatorSocialThreadsScopes.join(","));
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeCreatorSocialThreadsCode(code: string, reportStage?: StageReporter) {
  if (!code) throw new Error("Threads authorization code is missing.");
  const appId = getThreadsAppId();
  reportStage?.("threads-app-id-present");
  const appSecret = getThreadsAppSecret();
  reportStage?.("threads-app-secret-present");
  const redirectUri = getCreatorSocialThreadsRedirectUri();
  reportStage?.("callback-uri-resolved");

  const form = new FormData();
  form.set("client_id", appId);
  form.set("client_secret", appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);
  reportStage?.("token-exchange-request-prepared");
  reportStage?.("token-exchange-fetch-start");
  const shortResponse = await fetch("https://graph.threads.net/oauth/access_token", { method: "POST", body: form, cache: "no-store" });
  reportStage?.("token-exchange-response-received", { status: shortResponse.status });
  const shortPayload = await readJson<TokenPayload>(shortResponse);
  const shortToken = firstToken(shortPayload);
  if (!shortResponse.ok || !shortToken) throw new Error("Threads authorization code exchange failed.");

  const longUrl = new URL("https://graph.threads.net/access_token");
  longUrl.searchParams.set("grant_type", "th_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortToken.accessToken);
  reportStage?.("long-lived-exchange-start");
  const longResponse = await fetch(longUrl, { cache: "no-store" });
  const longPayload = await readJson<TokenPayload>(longResponse);
  const longToken = firstToken(longPayload);
  if (!longResponse.ok || !longToken) throw new Error("Threads long-lived token exchange failed.");

  return {
    accessToken: longToken.accessToken,
    expiresInSeconds: positiveNumber(longToken.expiresIn),
    tokenType: longToken.tokenType,
    userId: shortToken.userId,
    grantedScopes: grantedPermissions(shortPayload)
  };
}

export async function fetchCreatorSocialThreadsIdentity(accessToken: string, reportStage?: StageReporter) {
  const url = new URL("https://graph.threads.net/v1.0/me");
  url.searchParams.set("fields", "id,username,threads_profile_picture_url");
  url.searchParams.set("access_token", accessToken);
  reportStage?.("identity-request-start");
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson<Record<string, unknown>>(response);
  if (!response.ok || !stableId(payload.id)) throw new Error("Threads profile identity could not be verified.");
  const username = safeText(payload.username);
  return {
    externalId: stableId(payload.id)!,
    username,
    displayName: username ?? `Threads ${stableId(payload.id)!}`
  };
}

function firstToken(payload: TokenPayload) {
  const value = Array.isArray(payload.data) ? payload.data[0] : payload;
  if (!value || typeof value !== "object") return null;
  const record = value as TokenPayload;
  return typeof record.access_token === "string" && record.access_token
    ? {
        accessToken: record.access_token,
        expiresIn: record.expires_in,
        tokenType: typeof record.token_type === "string" && record.token_type ? record.token_type : "bearer",
        userId: stableId(record.user_id)
      }
    : null;
}

function grantedPermissions(payload: TokenPayload) {
  const root = Array.isArray(payload.data) ? payload.data[0] : payload;
  const permissions = root && typeof root === "object" ? (root as TokenPayload).permissions : null;
  return typeof permissions === "string"
    ? permissions.split(",").map((value) => value.trim()).filter(Boolean)
    : [...creatorSocialThreadsScopes];
}

function stableId(value: unknown) {
  if (typeof value === "string" && value) return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

async function readJson<T>(response: Response) {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

function getThreadsAppId() {
  const value = process.env.META_CREATOR_SOCIAL_THREADS_APP_ID;
  if (!value) throw new Error("META_CREATOR_SOCIAL_THREADS_APP_ID is not configured.");
  return value;
}

function getThreadsAppSecret() {
  const value = process.env.META_CREATOR_SOCIAL_THREADS_APP_SECRET;
  if (!value) throw new Error("META_CREATOR_SOCIAL_THREADS_APP_SECRET is not configured.");
  return value;
}

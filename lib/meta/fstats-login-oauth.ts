export const fstatsLoginConnectionKind = "fstats_login_facebook_page";
export const fstatsLoginIntegrationKind = "meta:fstats-login-facebook-page";
const productionOrigin = "https://love-strings-dashboard.vercel.app";
const localhostOrigin = "http://localhost:3000";
const fstatsLoginCallbackPath = "/api/integrations/meta/fstats-login/callback";
const graphApiVersion = "v23.0";

type MetaTokenResponse = { access_token?: unknown; expires_in?: unknown; token_type?: unknown };
type MetaPermissionsResponse = { data?: unknown };
type MetaPagesResponse = { data?: unknown };
type MetaIdentityResponse = { id?: unknown };
type MetaLinkedInstagramResponse = { instagram_business_account?: unknown };
type MetaGraphErrorPayload = { error?: { code?: unknown; error_subcode?: unknown; type?: unknown } };

export type MetaGraphFailureKind = "token" | "permission" | "rate_limit" | "provider";

export class MetaGraphRequestError extends Error {
  readonly kind: MetaGraphFailureKind;
  readonly retryable: boolean;

  constructor(kind: MetaGraphFailureKind, retryable: boolean) {
    super("Meta Graph request failed.");
    this.name = "MetaGraphRequestError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

export type DiscoveredFacebookPage = { externalId: string; displayName: string };
export type DiscoveredLinkedInstagram = { externalId: string; displayName: string };

export function getFstatsLoginRedirectUri(origin: string) {
  if (origin === productionOrigin || origin === localhostOrigin) {
    return `${origin}${fstatsLoginCallbackPath}`;
  }
  throw new Error("Meta Facebook Login is not configured for this app origin.");
}

export function createFstatsLoginAuthorizationUrl({ redirectUri, state }: { redirectUri: string; state: string }) {
  if (!state) throw new Error("OAuth authorization state is required.");
  const url = new URL(`https://www.facebook.com/${graphApiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", getMetaFstatsAppId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  // Facebook Login for Business configurations own the permission and asset selection.
  // Meta recommends config_id instead of a parallel scope list for this flow.
  url.searchParams.set("config_id", getMetaFstatsConfigId());
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeFstatsLoginAuthorizationCode(code: string, redirectUri: string) {
  if (!code) throw new Error("Meta authorization code is missing.");
  const url = new URL(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", getMetaFstatsAppId());
  url.searchParams.set("client_secret", getMetaFstatsAppSecret());
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", redirectUri);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson<MetaTokenResponse>(response);
  if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Meta authorization code exchange failed.");
  }
  return {
    accessToken: payload.access_token,
    expiresInSeconds: positiveNumber(payload.expires_in),
    tokenType: typeof payload.token_type === "string" && payload.token_type ? payload.token_type : "bearer"
  };
}

export async function fetchFstatsLoginGrantedScopes(accessToken: string) {
  const payload = await fetchGraph<MetaPermissionsResponse>("/me/permissions", accessToken);
  return normalizeGrantedScopes(payload.data);
}

export async function fetchFstatsLoginAuthorizationUserId(accessToken: string) {
  const payload = await fetchGraph<MetaIdentityResponse>("/me?fields=id", accessToken);
  return typeof payload.id === "string" && payload.id ? payload.id : null;
}

export async function discoverFstatsLoginFacebookPages(accessToken: string) {
  const payload = await fetchGraph<MetaPagesResponse>("/me/accounts?fields=id,name", accessToken);
  return normalizeFacebookPages(payload.data);
}

export async function discoverFstatsLoginLinkedInstagram(accessToken: string, pageExternalId: string) {
  if (!pageExternalId) return null;
  const payload = await fetchGraph<MetaLinkedInstagramResponse>(`/${encodeURIComponent(pageExternalId)}?fields=instagram_business_account{id,name,username}`, accessToken);
  const account = payload.instagram_business_account;
  if (!account || typeof account !== "object") return null;
  const record = account as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const label = typeof record.username === "string" && record.username.trim()
    ? record.username.trim()
    : typeof record.name === "string" && record.name.trim() ? record.name.trim() : `Instagram ${record.id}`;
  return { externalId: record.id, displayName: label } satisfies DiscoveredLinkedInstagram;
}

export function normalizeGrantedScopes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return record.status === "granted" && typeof record.permission === "string" && record.permission ? [record.permission] : [];
  }))).sort();
}

export function normalizeFacebookPages(value: unknown): DiscoveredFacebookPage[] {
  if (!Array.isArray(value)) return [];
  const pages = new Map<string, DiscoveredFacebookPage>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id || typeof record.name !== "string" || !record.name.trim()) continue;
    pages.set(record.id, { externalId: record.id, displayName: record.name.trim() });
  }
  return [...pages.values()];
}

async function fetchGraph<T>(path: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${graphApiVersion}${path}`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson<T & MetaGraphErrorPayload>(response);
  if (!response.ok) throw classifyGraphFailure(response.status, payload);
  return payload;
}

function classifyGraphFailure(status: number, payload: MetaGraphErrorPayload) {
  const code = typeof payload.error?.code === "number" ? payload.error.code : null;
  if (code === 190 || status === 401) return new MetaGraphRequestError("token", false);
  if (code === 10 || code === 200 || status === 403) return new MetaGraphRequestError("permission", false);
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) return new MetaGraphRequestError("rate_limit", true);
  return new MetaGraphRequestError("provider", status >= 500);
}

async function readJson<T>(response: Response) {
  try { return await response.json() as T; } catch { return {} as T; }
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getMetaFstatsAppId() {
  const value = process.env.META_FSTATS_APP_ID;
  if (!value) throw new Error("META_FSTATS_APP_ID is not configured.");
  return value;
}

function getMetaFstatsConfigId() {
  const value = process.env.META_FSTATS_CONFIG_ID?.trim();
  if (!value || !/^\d+$/.test(value)) {
    throw new Error("META_FSTATS_CONFIG_ID is not configured correctly.");
  }
  return value;
}

function getMetaFstatsAppSecret() {
  const value = process.env.META_FSTATS_APP_SECRET;
  if (!value) throw new Error("META_FSTATS_APP_SECRET is not configured.");
  return value;
}

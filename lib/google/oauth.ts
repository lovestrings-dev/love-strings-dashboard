import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type GoogleService = "analytics" | "youtube";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

const basicScopes = ["openid", "email", "profile"];
const serviceScopes: Record<GoogleService, string> = {
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  youtube: "https://www.googleapis.com/auth/youtube.readonly"
};

export function createGoogleAuthorizationUrl({
  loginHint,
  redirectUri,
  service,
  state
}: {
  loginHint?: string | null;
  redirectUri: string;
  service: GoogleService;
  state: string;
}) {
  const clientId = getGoogleClientId();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [...basicScopes, serviceScopes[service]].join(" "));
  url.searchParams.set("state", state);
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url;
}

export async function exchangeGoogleAuthorizationCode(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google authorization failed."
    );
  }

  return payload;
}

export async function fetchGoogleJson<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`Google API request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google access refresh failed."
    );
  }

  return payload.access_token;
}

export function encryptGoogleRefreshToken(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleRefreshToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored Google authorization is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export async function revokeGoogleToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    body: new URLSearchParams({ token }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
}

export function isGoogleService(value: string | null): value is GoogleService {
  return value === "analytics" || value === "youtube";
}

function getGoogleClientId() {
  const value = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!value) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured.");
  return value;
}

function getGoogleClientSecret() {
  const value = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!value) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not configured.");
  return value;
}

function getEncryptionKey() {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must contain 32 bytes.");
  }
  return key;
}

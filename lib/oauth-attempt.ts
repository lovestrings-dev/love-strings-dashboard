import { createHash } from "node:crypto";

export const oauthAttemptLifetimeMs = 10 * 60 * 1000;
export const defaultOAuthReturnPath = "/?settings=general";
export const integrationKindPattern = /^[a-z0-9][a-z0-9:_-]{0,99}$/;
export const localhostOAuthReturnOrigin = "http://localhost:3000";

export function getCanonicalOAuthOrigin() {
  const configured = process.env.APP_CANONICAL_ORIGIN?.trim();
  if (!configured) throw new Error("APP_CANONICAL_ORIGIN is not configured.");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("APP_CANONICAL_ORIGIN is not a valid origin.");
  }

  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new Error("APP_CANONICAL_ORIGIN must be an HTTPS origin without a path, query, or hash.");
  }

  return url.origin;
}

export function getAllowedOAuthReturnOrigins() {
  return new Set([localhostOAuthReturnOrigin, getCanonicalOAuthOrigin()]);
}

export function getAllowedOAuthReturnOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OAuth return origin is invalid.");
  }

  if (
    url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || !getAllowedOAuthReturnOrigins().has(url.origin)
  ) {
    throw new Error("OAuth return origin is not allowed.");
  }

  return url.origin;
}

export type OAuthAttemptRecord = {
  consumed_at: string | null;
  expires_at: string;
  integration_kind: string;
  return_path: string;
  user_id: string;
  workspace_id: string;
};

export type OAuthAttemptValidationReason =
  | "consumed"
  | "expired"
  | "integration-kind"
  | "user"
  | "workspace-authorization";

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function getSafeOAuthReturnPath(
  value: string | null | undefined,
  origin: string,
  fallback = defaultOAuthReturnPath
) {
  if (!value) return fallback;

  try {
    if (value.startsWith("//")) return fallback;
    const candidate = new URL(value, origin);
    const decodedPathname = decodeURIComponent(candidate.pathname);
    if (
      candidate.origin !== origin
      || !candidate.pathname.startsWith("/")
      || decodedPathname.startsWith("//")
      || decodedPathname.startsWith("/\\")
    ) {
      return fallback;
    }
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return fallback;
  }
}

export function createOAuthResultReturnUrl({
  origin,
  returnPath,
  result
}: {
  origin: string;
  returnPath: string;
  result: string;
}) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(result)) {
    throw new Error("OAuth result marker is invalid.");
  }
  const safeOrigin = getAllowedOAuthReturnOrigin(origin);
  const safePath = getSafeOAuthReturnPath(returnPath, safeOrigin, "");
  if (!safePath) throw new Error("OAuth return path is invalid.");

  const url = new URL(safePath, safeOrigin);
  url.searchParams.set("oauth", result);
  return url;
}

export function validateOAuthAttemptRecord(
  attempt: OAuthAttemptRecord,
  {
    authenticatedUserId,
    expectedIntegrationKind,
    now = new Date(),
    workspaceAuthorized
  }: {
    authenticatedUserId: string;
    expectedIntegrationKind: string;
    now?: Date;
    workspaceAuthorized: boolean;
  }
): OAuthAttemptValidationReason | null {
  if (attempt.consumed_at) return "consumed";
  if (Date.parse(attempt.expires_at) <= now.getTime()) return "expired";
  if (attempt.integration_kind !== expectedIntegrationKind) return "integration-kind";
  if (attempt.user_id !== authenticatedUserId) return "user";
  if (!workspaceAuthorized) return "workspace-authorization";
  return null;
}

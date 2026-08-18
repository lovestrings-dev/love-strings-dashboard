import { createHash } from "node:crypto";

export const oauthAttemptLifetimeMs = 10 * 60 * 1000;
export const defaultOAuthReturnPath = "/?settings=general";
export const integrationKindPattern = /^[a-z0-9][a-z0-9:_-]{0,99}$/;

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
    if (candidate.origin !== origin || !candidate.pathname.startsWith("/")) {
      return fallback;
    }
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return fallback;
  }
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

import { isMetaConnectionKind, missingMetaScopes, type MetaAppKind } from "./scopes";

export type MetaAccountType = "instagram_professional" | "threads_profile" | "facebook_page";

const platformForAccountType: Record<MetaAccountType, string> = {
  facebook_page: "facebook",
  instagram_professional: "instagram",
  threads_profile: "threads"
};

export function metaPlatformSlugForAccountType(accountType: MetaAccountType) {
  return platformForAccountType[accountType];
}

export function metaAccountIdentityKey(workspaceId: string, accountType: MetaAccountType, externalId: string) {
  return `${workspaceId}:${platformForAccountType[accountType]}:${externalId}`;
}

export function toSafeMetaConnectionStatus(row: {
  app_kind: string; connection_kind: string; connection_state: string; granted_scopes: string[] | null; id: string;
  last_error_code: string | null; last_error_summary: string | null; last_successful_sync_at: string | null;
  token_expires_at: string | null; updated_at: string;
}) {
  if (!isMetaConnectionKind(row.connection_kind)) throw new Error("Unknown Meta connection type.");
  const grantedScopes = row.granted_scopes ?? [];
  return {
    appKind: row.app_kind as MetaAppKind,
    connectionKind: row.connection_kind,
    connectionState: row.connection_state,
    grantedScopes,
    id: row.id,
    lastError: row.last_error_code || row.last_error_summary ? { code: row.last_error_code, summary: row.last_error_summary } : null,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    missingScopes: missingMetaScopes(row.connection_kind, grantedScopes),
    tokenExpiresAt: row.token_expires_at,
    updatedAt: row.updated_at
  };
}

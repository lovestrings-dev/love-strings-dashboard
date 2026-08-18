import type { SupabaseClient } from "@supabase/supabase-js";

import {
  databaseFailureState,
  deriveFstatsLoginState,
  type FstatsAccountRow,
  type FstatsCandidateRow,
  type FstatsConnectionRow,
  type FstatsInstagramBindingRow,
  type FstatsLoginState,
  type FstatsMappingRow,
  type FstatsPageBindingRow,
} from "@/lib/meta/fstats-login-state";

type QueryResult<T> = { data: T | null; error: unknown };

function rowsOrThrow<T>(result: QueryResult<T[]>, label: string) {
  if (result.error) throw new Error(`Authoritative Meta state query failed: ${label}.`);
  return result.data ?? [];
}

export async function readAuthoritativeFstatsLoginState(
  client: SupabaseClient,
  workspaceId: string,
  now = new Date(),
): Promise<FstatsLoginState> {
  try {
    const connections = rowsOrThrow(await client
      .from("app_meta_connections")
      .select("id, connection_kind, connection_state, granted_scopes, token_expires_at, last_error_code, last_error_summary, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("connection_kind", "fstats_login_facebook_page")
      .limit(2) as QueryResult<FstatsConnectionRow[]>, "connections");

    if (connections.length !== 1) {
      return deriveFstatsLoginState({
        now: now.toISOString(), workspaceId, connections, candidates: [], mappings: [], accounts: [], pageBindings: [], instagramBindings: [],
      });
    }

    const connectionId = connections[0].id;
    const [candidateResult, mappingResult] = await Promise.all([
      client.from("app_meta_discovered_assets")
        .select("id, account_type, external_id, display_name, parent_external_id, asset_state, discovered_at, updated_at")
        .eq("workspace_id", workspaceId).eq("connection_id", connectionId),
      client.from("app_meta_connection_accounts")
        .select("id, account_type, platform_account_id, parent_platform_account_id, is_selected, asset_state, last_successful_sync_at, last_error_code, last_error_summary, updated_at")
        .eq("workspace_id", workspaceId).eq("connection_id", connectionId),
    ]);
    const candidates = rowsOrThrow(candidateResult as QueryResult<FstatsCandidateRow[]>, "discovered assets");
    const mappings = rowsOrThrow(mappingResult as QueryResult<FstatsMappingRow[]>, "account mappings");
    const accountIds = Array.from(new Set(mappings.flatMap((mapping) => [mapping.platform_account_id, mapping.parent_platform_account_id].filter(Boolean) as string[])));
    const accountResult = accountIds.length
      ? await client.from("platform_accounts").select("id, meta_external_id, account_name").in("id", accountIds)
      : { data: [], error: null };
    const accounts = rowsOrThrow(accountResult as QueryResult<FstatsAccountRow[]>, "platform accounts");
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const selectedPageIds = mappings.filter((mapping) => mapping.account_type === "facebook_page" && mapping.is_selected)
      .flatMap((mapping) => accountsById.get(mapping.platform_account_id)?.meta_external_id ?? []);
    const selectedInstagramIds = mappings.filter((mapping) => mapping.account_type === "instagram_professional" && mapping.is_selected)
      .flatMap((mapping) => accountsById.get(mapping.platform_account_id)?.meta_external_id ?? []);
    const candidatePageIds = Array.from(new Set([...candidates.filter((candidate) => candidate.account_type === "facebook_page").map((candidate) => candidate.external_id), ...selectedPageIds]));
    const candidateInstagramIds = Array.from(new Set([...candidates.filter((candidate) => candidate.account_type === "instagram_professional").map((candidate) => candidate.external_id), ...selectedInstagramIds]));

    const [pageBindingResult, instagramBindingResult] = await Promise.all([
      candidatePageIds.length
        ? client.from("app_meta_active_page_bindings").select("external_id, workspace_id, connection_id, mapping_id").in("external_id", candidatePageIds)
        : Promise.resolve({ data: [], error: null }),
      candidateInstagramIds.length
        ? client.from("app_meta_active_instagram_bindings").select("external_id, workspace_id, connection_id, mapping_id, parent_page_external_id").in("external_id", candidateInstagramIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    return deriveFstatsLoginState({
      now: now.toISOString(),
      workspaceId,
      connections,
      candidates,
      mappings,
      accounts,
      pageBindings: rowsOrThrow(pageBindingResult as QueryResult<FstatsPageBindingRow[]>, "Page bindings"),
      instagramBindings: rowsOrThrow(instagramBindingResult as QueryResult<FstatsInstagramBindingRow[]>, "Instagram bindings"),
    });
  } catch {
    return databaseFailureState();
  }
}

export function authoritativeStateHttpStatus(state: FstatsLoginState) {
  return state.stage === "needs_attention" && state.attention.code === "DATABASE_QUERY_FAILED" ? 503 : 200;
}

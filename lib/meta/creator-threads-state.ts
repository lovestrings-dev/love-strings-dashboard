type ThreadsAccount = { meta_external_id: string; account_name: string; url: string | null };
type ThreadsMapping = { account_type: string; is_selected: boolean; platform_accounts: ThreadsAccount };
type ThreadsConnectionRow = {
  id: string;
  connection_state: string;
  token_expires_at: string | null;
  app_meta_connection_accounts?: ThreadsMapping[];
};

export function resolveCreatorSocialThreadsState(rows: ThreadsConnectionRow[]) {
  if (rows.length === 0) return { state: "disconnected" as const };
  const selected = rows
    .map((row) => ({ row, mapping: row.app_meta_connection_accounts?.find((item) => item.account_type === "threads_profile" && item.is_selected) }))
    .filter((item) => item.mapping);
  const current = selected.find((item) => item.row.connection_state === "connected") ?? selected[0] ?? { row: rows[0], mapping: undefined };
  // Disconnect deliberately retains the canonical connection/account history
  // for a safe stable-ID reconnect, but disables its selected mapping and puts
  // the connection in no_data. That is a normal inactive state, not damage.
  if (selected.length === 0 && rows.every((row) => row.connection_state === "no_data")) {
    return { state: "disconnected" as const };
  }
  const { row, mapping } = current;
  const account = mapping
    ? { externalId: mapping.platform_accounts.meta_external_id, displayName: mapping.platform_accounts.account_name, url: mapping.platform_accounts.url }
    : undefined;
  if (row.connection_state !== "connected" || !mapping) return { state: "degraded" as const, connectionId: row.id, account };
  return { state: "connected" as const, connectionId: row.id, tokenExpiresAt: row.token_expires_at, account };
}

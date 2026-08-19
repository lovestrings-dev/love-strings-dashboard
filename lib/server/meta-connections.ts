import type { SupabaseClient } from "@supabase/supabase-js";

import { metaPlatformSlugForAccountType, toSafeMetaConnectionStatus, type MetaAccountType } from "@/lib/meta/foundation";
import { resolveCreatorSocialInstagramState } from "@/lib/meta/creator-instagram-state";
import { normalizeMetaPageSelectionError } from "@/lib/meta/selection-error";
import { hasRequiredMetaScopes, metaAppKindForConnectionKind, type MetaConnectionKind } from "@/lib/meta/scopes";
import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

export { toSafeMetaConnectionStatus, type MetaAccountType } from "@/lib/meta/foundation";
export { MetaPageSelectionError } from "@/lib/meta/selection-error";

export class CreatorSocialInstagramDuplicateError extends Error {
  constructor() { super("This Instagram account is already connected through Facebook."); }
}

export async function bindCreatorSocialInstagram(input: {
  workspaceId: string;
  connectedBy: string;
  authorizationUserExternalId: string | null;
  encryptedTokenPayload: string;
  tokenExpiresAt: string | null;
  tokenType: string;
  grantedScopes: string[];
  identity: { externalId: string; displayName: string; username: string | null };
}) {
  const client = createServiceSupabaseClient();
  const { data, error } = await (client as any).rpc("bind_creator_social_instagram", {
    p_authorization_user_external_id: input.authorizationUserExternalId,
    p_connected_by: input.connectedBy,
    p_display_name: input.identity.displayName,
    p_encrypted_token_payload: input.encryptedTokenPayload,
    p_external_id: input.identity.externalId,
    p_granted_scopes: Array.from(new Set(input.grantedScopes)),
    p_token_expires_at: input.tokenExpiresAt,
    p_token_type: input.tokenType,
    p_username: input.identity.username,
    p_workspace_id: input.workspaceId
  }).single();
  if (error?.code === "P2101") throw new CreatorSocialInstagramDuplicateError();
  if (error || !data) throw error ?? new Error("Standalone Instagram could not be bound.");
  return data as { connection_id: string; platform_account_id: string };
}

export async function readCreatorSocialInstagramState(client: SupabaseClient, workspaceId: string) {
  const { data, error } = await client.from("app_meta_connections")
    .select("id, connection_state, token_expires_at, last_error_code, last_error_summary, updated_at, app_meta_connection_accounts!inner(is_selected, asset_state, account_type, platform_accounts!app_meta_connection_accounts_platform_account_id_fkey!inner(meta_external_id, account_name, url))")
    .eq("workspace_id", workspaceId).eq("connection_kind", "creator_social_instagram")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return resolveCreatorSocialInstagramState((data ?? []) as any[]);
}

export async function saveMetaConnection(client: SupabaseClient, input: {
  workspaceId: string;
  connectionKind: MetaConnectionKind;
  authorizationUserExternalId?: string | null;
  connectedBy: string;
  encryptedTokenPayload: string;
  tokenExpiresAt?: string | null;
  tokenRefreshedAt?: string | null;
  tokenType: string;
  grantedScopes: string[];
}) {
  const hasRequiredScopes = hasRequiredMetaScopes(input.connectionKind, input.grantedScopes);
  // A Facebook Login authorization is not a workspace Page connection. Start it
  // pending selection; candidate discovery can restore `connected` only when an
  // existing explicit Page binding is confirmed.
  const connectionState = input.connectionKind === "fstats_login_facebook_page" && hasRequiredScopes
    ? "awaiting_selection"
    : hasRequiredScopes ? "connected" : "reauthorization_required";
  const { data, error } = await client
    .from("app_meta_connections")
    .upsert({
      app_kind: metaAppKindForConnectionKind(input.connectionKind),
      connection_kind: input.connectionKind,
      authorization_user_external_id: input.authorizationUserExternalId ?? null,
      connected_by: input.connectedBy,
      connection_state: connectionState,
      encrypted_token_payload: input.encryptedTokenPayload,
      granted_scopes: Array.from(new Set(input.grantedScopes)),
      reauthorization_required_at: hasRequiredScopes ? null : new Date().toISOString(),
      token_expires_at: input.tokenExpiresAt ?? null,
      token_refreshed_at: input.tokenRefreshedAt ?? null,
      token_type: input.tokenType,
      workspace_id: input.workspaceId
    }, { onConflict: "workspace_id,connection_kind,authorization_user_external_id" })
    .select("id, workspace_id, app_kind, connection_kind, connection_state, granted_scopes")
    .single();
  if (error || !data) throw error ?? new Error("Meta connection could not be saved.");
  return data;
}

export async function reconcileMetaPlatformAccount(client: SupabaseClient, input: {
  workspaceId: string;
  connectionId: string;
  accountType: MetaAccountType;
  externalId: string;
  displayName: string;
  username?: string | null;
  parentPlatformAccountId?: string | null;
}) {
  if (!input.externalId) throw new Error("Meta external account ID is required.");
  const { data: connection, error: connectionError } = await client
    .from("app_meta_connections").select("id, connection_kind").eq("id", input.connectionId)
    .eq("workspace_id", input.workspaceId).maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw new Error("Meta connection is not available in this workspace.");
  if (
    (connection.connection_kind === "fstats_login_facebook_page" && input.accountType === "threads_profile") ||
    (connection.connection_kind === "creator_social_instagram" && input.accountType !== "instagram_professional") ||
    (connection.connection_kind === "creator_social_threads" && input.accountType !== "threads_profile")
  ) throw new Error("Meta account type is not valid for this connection kind.");

  const { data: platform, error: platformError } = await client
    .from("platforms").select("id").eq("slug", metaPlatformSlugForAccountType(input.accountType)).maybeSingle();
  if (platformError) throw platformError;
  if (!platform) throw new Error("Meta platform is not available.");

  const { data: rows, error: accountError } = await client
    .from("platform_accounts").select("id").eq("workspace_id", input.workspaceId)
    .eq("platform_id", platform.id).eq("meta_external_id", input.externalId).limit(2);
  if (accountError) throw accountError;
  if ((rows ?? []).length > 1) throw new Error("Duplicate Meta external identity requires Admin resolution.");

  const existing = rows?.[0];
  const profileUrl = input.username
    ? input.accountType === "instagram_professional"
      ? `https://www.instagram.com/${input.username}`
      : input.accountType === "threads_profile"
        ? `https://www.threads.com/@${input.username}`
        : null
    : null;
  let platformAccountId = existing?.id as string | undefined;
  if (platformAccountId) {
    const { error } = await client.from("platform_accounts").update({
      account_name: input.displayName,
      meta_external_id: input.externalId,
      url: profileUrl
    }).eq("id", platformAccountId).eq("workspace_id", input.workspaceId);
    if (error) throw error;
  } else {
    const { data, error } = await client.from("platform_accounts").insert({
      account_name: input.displayName,
      external_id: input.externalId,
      meta_external_id: input.externalId,
      platform_id: platform.id,
      url: profileUrl,
      workspace_id: input.workspaceId
    }).select("id").single();
    if (error || !data) throw error ?? new Error("Meta account could not be saved.");
    platformAccountId = data.id as string;
  }

  if (input.parentPlatformAccountId) {
    const { data: parent, error } = await client.from("platform_accounts").select("id")
      .eq("id", input.parentPlatformAccountId).eq("workspace_id", input.workspaceId).maybeSingle();
    if (error) throw error;
    if (!parent) throw new Error("Meta parent account is not available in this workspace.");
  }
  const { data: mapping, error: mappingError } = await client
    .from("app_meta_connection_accounts")
    .upsert({
      account_type: input.accountType,
      connection_id: input.connectionId,
      parent_platform_account_id: input.parentPlatformAccountId ?? null,
      platform_account_id: platformAccountId,
      workspace_id: input.workspaceId
    }, { onConflict: "connection_id,platform_account_id" })
    .select("id, platform_account_id, account_type, workspace_id")
    .single();
  if (mappingError || !mapping) throw mappingError ?? new Error("Meta account mapping could not be saved.");
  return mapping;
}

export async function saveMetaFacebookPageCandidates(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pages: Array<{ externalId: string; displayName: string }>;
}) {
  const ids = input.pages.map((page) => page.externalId);
  const { data: priorCandidates, error: priorCandidateError } = await client.from("app_meta_discovered_assets")
    .select("external_id").eq("workspace_id", input.workspaceId).eq("connection_id", input.connectionId)
    .eq("account_type", "facebook_page");
  if (priorCandidateError) throw priorCandidateError;
  if (input.pages.length) {
    const { error } = await client.from("app_meta_discovered_assets").upsert(input.pages.map((page) => ({
      workspace_id: input.workspaceId, connection_id: input.connectionId, account_type: "facebook_page",
      external_id: page.externalId, display_name: page.displayName, asset_state: "available"
    })), { onConflict: "connection_id,account_type,external_id" });
    if (error) throw error;
  }
  const staleIds = (priorCandidates ?? []).map((candidate) => candidate.external_id).filter((externalId) => !ids.includes(externalId));
  if (staleIds.length) {
    const { error } = await client.from("app_meta_discovered_assets").update({ asset_state: "missing" })
      .eq("workspace_id", input.workspaceId).eq("connection_id", input.connectionId)
      .eq("account_type", "facebook_page").in("external_id", staleIds);
    if (error) throw error;
  }
  const { data: selected, error: selectedError } = await client.from("app_meta_connection_accounts")
    .select("id, platform_account_id").eq("workspace_id", input.workspaceId)
    .eq("connection_id", input.connectionId).eq("account_type", "facebook_page").eq("is_selected", true).maybeSingle();
  if (selectedError) throw selectedError;
  const { data: selectedAccount, error: selectedAccountError } = selected?.platform_account_id
    ? await client.from("platform_accounts").select("meta_external_id")
      .eq("id", selected.platform_account_id).eq("workspace_id", input.workspaceId).maybeSingle()
    : { data: null, error: null };
  if (selectedAccountError) throw selectedAccountError;
  const selectedExternalId = selectedAccount?.meta_external_id;
  const selectedMissing = Boolean(selectedExternalId && !ids.includes(selectedExternalId));
  const state = selectedMissing ? "degraded" : selectedExternalId ? "connected" : "awaiting_selection";
  const { error: connectionError } = await client.from("app_meta_connections").update({
    connection_state: state,
    last_error_code: selectedMissing ? "selected_page_missing" : null,
    last_error_summary: selectedMissing ? "The selected Facebook Page is no longer available from Meta." : null
  }).eq("id", input.connectionId).eq("workspace_id", input.workspaceId);
  if (connectionError) throw connectionError;
}

export async function selectMetaFacebookPage(client: SupabaseClient, input: { workspaceId: string; connectionId: string; externalId: string }) {
  const { data, error } = await (client as any).rpc("select_meta_facebook_page", {
    p_workspace_id: input.workspaceId, p_connection_id: input.connectionId, p_external_id: input.externalId
  }).single();
  if (error) throw normalizeMetaPageSelectionError(error);
  if (!data) throw new Error("Meta Page selection could not be saved.");
  return data as { mapping_id: string; platform_account_id: string; page_changed: boolean };
}


export async function saveMetaLinkedInstagramCandidate(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string;
  instagram: { externalId: string; displayName: string } | null;
}) {
  if (!input.instagram) return null;
  const { data, error } = await client.from("app_meta_discovered_assets").upsert({
    workspace_id: input.workspaceId, connection_id: input.connectionId,
    account_type: "instagram_professional", external_id: input.instagram.externalId,
    display_name: input.instagram.displayName, parent_external_id: input.pageExternalId,
    asset_state: "available"
  }, { onConflict: "connection_id,account_type,external_id" }).select("external_id, display_name, asset_state").single();
  if (error || !data) throw error ?? new Error("Linked Instagram candidate could not be saved.");
  return data;
}

export async function selectMetaLinkedInstagram(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string; instagramExternalId: string;
}) {
  const { data, error } = await (client as any).rpc("select_meta_linked_instagram", {
    p_workspace_id: input.workspaceId, p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId, p_instagram_external_id: input.instagramExternalId
  }).single();
  if (error || !data) throw error ?? new Error("Linked Instagram selection could not be saved.");
  return data as { mapping_id: string; platform_account_id: string };
}

async function singleRpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>, fallback: string) {
  const { data, error } = await (client as any).rpc(name, args).single();
  if (error || !data) throw error ?? new Error(fallback);
  return data as T;
}

export async function startMetaLinkedInstagramDiscovery(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string;
}) {
  return singleRpc<{ started: boolean }>(client, "start_meta_linked_instagram_discovery", {
    p_workspace_id: input.workspaceId, p_connection_id: input.connectionId, p_page_external_id: input.pageExternalId,
  }, "Linked Instagram discovery could not be started.");
}

export async function reconcileMetaLinkedInstagramDiscovery(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string;
  instagram: { externalId: string; displayName: string } | null;
}) {
  return singleRpc<{ linked_instagram_external_id: string | null }>(client, "reconcile_meta_linked_instagram_discovery", {
    p_workspace_id: input.workspaceId,
    p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId,
    p_instagram_external_id: input.instagram?.externalId ?? null,
    p_instagram_display_name: input.instagram?.displayName ?? null,
  }, "Linked Instagram discovery could not be reconciled.");
}

export async function recordMetaLinkedInstagramDiscoveryFailure(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string; errorCode: string; errorSummary: string;
}) {
  return singleRpc<{ recorded: boolean }>(client, "record_meta_linked_instagram_discovery_failure", {
    p_workspace_id: input.workspaceId,
    p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId,
    p_error_code: input.errorCode,
    p_error_summary: input.errorSummary,
  }, "Linked Instagram discovery failure could not be recorded.");
}

export async function skipMetaLinkedInstagram(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string; instagramExternalId: string;
}) {
  return singleRpc<{ skipped: boolean }>(client, "skip_meta_linked_instagram", {
    p_workspace_id: input.workspaceId,
    p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId,
    p_instagram_external_id: input.instagramExternalId,
  }, "Linked Instagram decision could not be saved.");
}

export async function disconnectMetaLinkedInstagram(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string; instagramExternalId: string;
}) {
  return singleRpc<{ disconnected: boolean }>(client, "disconnect_meta_linked_instagram", {
    p_workspace_id: input.workspaceId,
    p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId,
    p_instagram_external_id: input.instagramExternalId,
  }, "Instagram could not be disconnected from this workspace.");
}

export async function disconnectMetaFacebookPage(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string;
}) {
  return singleRpc<{ disconnected: boolean }>(client, "disconnect_meta_facebook_page", {
    p_workspace_id: input.workspaceId,
    p_connection_id: input.connectionId,
    p_page_external_id: input.pageExternalId,
  }, "Facebook Page could not be disconnected from this workspace.");
}

export async function setMetaAccountSelected(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; mappingId: string; selected: boolean;
}) {
  const { data: mapping, error } = await client.from("app_meta_connection_accounts")
    .select("id, account_type").eq("id", input.mappingId).eq("connection_id", input.connectionId)
    .eq("workspace_id", input.workspaceId).maybeSingle();
  if (error) throw error;
  if (!mapping) throw new Error("Meta account is not available in this workspace.");
  if (input.selected) {
    const { error: clearError } = await client.from("app_meta_connection_accounts")
      .update({ asset_state: "discovered", is_selected: false }).eq("connection_id", input.connectionId)
      .eq("workspace_id", input.workspaceId).eq("account_type", mapping.account_type).neq("id", input.mappingId);
    if (clearError) throw clearError;
  }
  const { error: updateError } = await client.from("app_meta_connection_accounts")
    .update({ asset_state: input.selected ? "selected" : "disabled", is_selected: input.selected })
    .eq("id", input.mappingId).eq("connection_id", input.connectionId).eq("workspace_id", input.workspaceId);
  if (updateError) throw updateError;
}

export async function disconnectMetaConnection(client: SupabaseClient, workspaceId: string, connectionId: string) {
  const { error } = await client.from("app_meta_connections").delete()
    .eq("id", connectionId).eq("workspace_id", workspaceId);
  if (error) throw error;
}

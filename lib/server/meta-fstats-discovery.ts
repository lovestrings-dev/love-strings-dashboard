import type { SupabaseClient } from "@supabase/supabase-js";

import { discoverFstatsLoginFacebookPages, discoverFstatsLoginLinkedInstagram, MetaGraphRequestError } from "@/lib/meta/fstats-login-oauth";
import { decryptMetaTokenPayload } from "@/lib/meta/tokens";
import {
  reconcileMetaLinkedInstagramDiscovery,
  recordMetaLinkedInstagramDiscoveryFailure,
  saveMetaFacebookPageCandidates,
  startMetaLinkedInstagramDiscovery,
} from "@/lib/server/meta-connections";

export type FacebookPageDiscoveryResult =
  | { outcome: "succeeded"; candidateCount: number }
  | { outcome: "failed"; code: string; retryable: boolean };

export async function runFacebookPageDiscovery(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; preserveValidBindingOnFailure?: boolean;
}): Promise<FacebookPageDiscoveryResult> {
  try {
    const { data: connection, error } = await client.from("app_meta_connections")
      .select("encrypted_token_payload")
      .eq("id", input.connectionId).eq("workspace_id", input.workspaceId)
      .eq("connection_kind", "fstats_login_facebook_page").single();
    if (error || !connection) throw error ?? new Error("Meta connection is unavailable.");
    const pages = await discoverFstatsLoginFacebookPages(decryptMetaTokenPayload(connection.encrypted_token_payload).accessToken);
    await saveMetaFacebookPageCandidates(client, {
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
      pages,
    });
    return { outcome: "succeeded", candidateCount: pages.length };
  } catch (error) {
    const graphError = error instanceof MetaGraphRequestError ? error : null;
    const code = graphError ? `meta_graph_${graphError.kind}` : "page_discovery_failed";
    const summary = graphError?.kind === "token" || graphError?.kind === "permission"
      ? "Meta authorization must be renewed before Facebook Pages can be refreshed."
      : "Facebook Pages could not be refreshed. Try again.";
    const authorizationInvalid = graphError?.kind === "token" || graphError?.kind === "permission";
    if (!input.preserveValidBindingOnFailure || authorizationInvalid) {
      const { error: recordError } = await client.from("app_meta_connections").update({
        last_error_code: code, last_error_summary: summary,
        ...(authorizationInvalid ? { connection_state: "reauthorization_required" } : {}),
      }).eq("id", input.connectionId).eq("workspace_id", input.workspaceId)
        .eq("connection_kind", "fstats_login_facebook_page");
      if (recordError) throw new Error("Facebook Page discovery failure could not be recorded.");
    }
    return { outcome: "failed", code, retryable: graphError?.retryable ?? true };
  }
}

export type LinkedInstagramDiscoveryResult =
  | { outcome: "succeeded"; linkedInstagramExternalId: string | null }
  | { outcome: "failed"; code: string; retryable: boolean; persistenceFailed?: boolean };

export async function runLinkedInstagramDiscovery(client: SupabaseClient, input: {
  workspaceId: string; connectionId: string; pageExternalId: string;
}): Promise<LinkedInstagramDiscoveryResult> {
  try {
    await startMetaLinkedInstagramDiscovery(client, input);
    const { data: connection, error } = await client.from("app_meta_connections")
      .select("encrypted_token_payload")
      .eq("id", input.connectionId)
      .eq("workspace_id", input.workspaceId)
      .eq("connection_kind", "fstats_login_facebook_page")
      .single();
    if (error || !connection) throw error ?? new Error("Meta connection is unavailable.");
    const instagram = await discoverFstatsLoginLinkedInstagram(
      decryptMetaTokenPayload(connection.encrypted_token_payload).accessToken,
      input.pageExternalId,
    );
    await reconcileMetaLinkedInstagramDiscovery(client, { ...input, instagram });
    return { outcome: "succeeded", linkedInstagramExternalId: instagram?.externalId ?? null };
  } catch (error) {
    const graphError = error instanceof MetaGraphRequestError ? error : null;
    const code = graphError ? `meta_graph_${graphError.kind}` : "instagram_discovery_failed";
    const summary = graphError?.kind === "token" || graphError?.kind === "permission"
      ? "Meta authorization must be renewed before the linked Instagram account can be checked."
      : "The linked Instagram check failed. Retry without changing the selected Facebook Page.";
    try {
      await recordMetaLinkedInstagramDiscoveryFailure(client, { ...input, errorCode: code, errorSummary: summary });
      return { outcome: "failed", code, retryable: graphError?.retryable ?? true };
    } catch {
      return { outcome: "failed", code: "database_persistence_failed", retryable: true, persistenceFailed: true };
    }
  }
}

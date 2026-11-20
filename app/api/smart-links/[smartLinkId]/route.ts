import { type NextRequest } from "next/server";
import {
  errorMessage,
  errorStatus,
  isSameOriginSmartLinkWrite,
  isUuid,
  normalizeLinkPatch,
  requireSmartLinkManager,
  smartLinkResponse,
  SmartLinkInputError,
  validateRevision
} from "@/lib/server/smart-links";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

type Context = { params: Promise<{ smartLinkId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { smartLinkId } = await context.params;
    if (!isUuid(smartLinkId)) throw new SmartLinkInputError("Smart Link id is invalid.");
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const { data: link, error } = await serviceClient
      .from("smart_links")
      .select("id, workspace_id, production_song_id, public_slug, status, source_song_title, source_artist_name, source_artwork_url, title_override, artist_name_override, artwork_url_override, background_mode, background_color, social_links, pixel_mode, pixel_override_id, published_at, disabled_at, archived_at, created_at, updated_at")
      .eq("id", smartLinkId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!link) return smartLinkResponse({ error: "Smart Link was not found." }, 404);
    const { data: destinations, error: destinationsError } = await serviceClient
      .from("smart_link_destinations")
      .select("id, smart_link_id, platform_key, button_label, target_url, source_kind, source_metadata, position, is_enabled, retired_at, created_at, updated_at")
      .eq("smart_link_id", smartLinkId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (destinationsError) throw destinationsError;
    return smartLinkResponse({ smartLink: { link, destinations: destinations ?? [] }, canManage: role !== "viewer" });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Smart Link is unavailable.") }, errorStatus(error));
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!isSameOriginSmartLinkWrite(request)) return smartLinkResponse({ error: "Unauthorized request." }, 401);
  try {
    const { smartLinkId } = await context.params;
    if (!isUuid(smartLinkId)) throw new SmartLinkInputError("Smart Link id is invalid.");
    const { expectedUpdatedAt, updates } = await request.json() as { expectedUpdatedAt?: unknown; updates?: unknown };
    const { serviceClient, workspaceId, user } = await requireSmartLinkManager(request);
    const { data, error } = await serviceClient.rpc("smart_link_management_mutate", {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_action: "update",
      p_link_id: smartLinkId,
      p_expected_updated_at: validateRevision(expectedUpdatedAt),
      p_payload: normalizeLinkPatch(updates)
    });
    if (error) throw error;
    return smartLinkResponse({ smartLink: data });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Smart Link update failed.") }, errorStatus(error));
  }
}

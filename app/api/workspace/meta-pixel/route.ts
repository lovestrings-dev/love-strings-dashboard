import { type NextRequest } from "next/server";
import {
  errorMessage,
  errorStatus,
  isSameOriginSmartLinkWrite,
  normalizePixelId,
  requireSmartLinkManager,
  smartLinkResponse,
  validateRevision
} from "@/lib/server/smart-links";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient
      .from("workspace_meta_pixel_settings")
      .select("workspace_id, default_pixel_id, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    return smartLinkResponse({ settings: data, canManage: role !== "viewer", workspaceId });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Meta Pixel settings are unavailable.") }, errorStatus(error));
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginSmartLinkWrite(request)) return smartLinkResponse({ error: "Unauthorized request." }, 401);
  try {
    const { expectedUpdatedAt, defaultPixelId } = await request.json() as { expectedUpdatedAt?: unknown; defaultPixelId?: unknown };
    const { serviceClient, workspaceId, user } = await requireSmartLinkManager(request);
    const { data, error } = await serviceClient.rpc("smart_link_update_workspace_pixel_settings", {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_expected_updated_at: expectedUpdatedAt === null || expectedUpdatedAt === undefined ? null : validateRevision(expectedUpdatedAt),
      p_default_pixel_id: normalizePixelId(defaultPixelId)
    });
    if (error) throw error;
    return smartLinkResponse({ settings: data });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Meta Pixel settings update failed.") }, errorStatus(error));
  }
}

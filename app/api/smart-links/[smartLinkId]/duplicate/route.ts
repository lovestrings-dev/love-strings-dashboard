import { type NextRequest } from "next/server";
import {
  errorMessage,
  errorStatus,
  isSameOriginSmartLinkWrite,
  isUuid,
  requireSmartLinkManager,
  smartLinkResponse,
  SmartLinkInputError,
  validateExplicitSlug,
  validateRevision
} from "@/lib/server/smart-links";

type Context = { params: Promise<{ smartLinkId: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (!isSameOriginSmartLinkWrite(request)) return smartLinkResponse({ error: "Unauthorized request." }, 401);
  try {
    const { smartLinkId } = await context.params;
    if (!isUuid(smartLinkId)) throw new SmartLinkInputError("Smart Link id is invalid.");
    const { expectedUpdatedAt, slug } = await request.json() as { expectedUpdatedAt?: unknown; slug?: unknown };
    const { serviceClient, workspaceId, user } = await requireSmartLinkManager(request);
    const { data, error } = await serviceClient.rpc("smart_link_management_mutate", {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_action: "duplicate",
      p_link_id: smartLinkId,
      p_expected_updated_at: validateRevision(expectedUpdatedAt),
      p_payload: { slug: validateExplicitSlug(slug) }
    });
    if (error) throw error;
    return smartLinkResponse({ smartLink: data }, 201);
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Smart Link duplication failed.") }, errorStatus(error));
  }
}

import { type NextRequest } from "next/server";
import {
  errorMessage,
  errorStatus,
  isSameOriginSmartLinkWrite,
  isUuid,
  normalizeDestinations,
  normalizeLinkPatch,
  normalizeSlug,
  requireSmartLinkManager,
  smartLinkResponse,
  SmartLinkInputError
} from "@/lib/server/smart-links";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const status = request.nextUrl.searchParams.get("status");
    const productionSongId = request.nextUrl.searchParams.get("productionSongId");
    if (status && !["draft", "published", "disabled", "archived"].includes(status)) {
      throw new SmartLinkInputError("Smart Link status filter is invalid.");
    }
    if (productionSongId && !isUuid(productionSongId)) throw new SmartLinkInputError("Production song filter is invalid.");
    let query = serviceClient
      .from("smart_links")
      .select("id, workspace_id, production_song_id, public_slug, status, source_song_title, source_artist_name, source_artwork_url, title_override, artist_name_override, artwork_url_override, background_mode, background_color, social_links, pixel_mode, pixel_override_id, published_at, disabled_at, archived_at, created_at, updated_at, smart_link_destinations(id, platform_key, is_enabled, retired_at)")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (productionSongId) query = query.eq("production_song_id", productionSongId);
    const { data, error } = await query;
    if (error) throw error;
    const linkIds = (data ?? []).map((link) => link.id);
    const destinationIds = (data ?? []).flatMap((link) => (link.smart_link_destinations ?? []).map((destination) => destination.id));
    const [viewsResult, clicksResult] = await Promise.all([
      linkIds.length
        ? serviceClient.from("smart_link_daily_metrics").select("smart_link_id, page_view_count").in("smart_link_id", linkIds)
        : Promise.resolve({ data: [], error: null }),
      destinationIds.length
        ? serviceClient.from("smart_link_destination_daily_metrics").select("destination_id, click_count").in("destination_id", destinationIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (viewsResult.error) throw viewsResult.error;
    if (clicksResult.error) throw clicksResult.error;
    const viewsByLink = new Map<string, number>();
    for (const metric of viewsResult.data ?? []) viewsByLink.set(metric.smart_link_id, (viewsByLink.get(metric.smart_link_id) ?? 0) + Number(metric.page_view_count));
    const linkByDestination = new Map((data ?? []).flatMap((link) => (link.smart_link_destinations ?? []).map((destination) => [destination.id, link.id] as const)));
    const clicksByLink = new Map<string, number>();
    for (const metric of clicksResult.data ?? []) {
      const linkId = linkByDestination.get(metric.destination_id);
      if (linkId) clicksByLink.set(linkId, (clicksByLink.get(linkId) ?? 0) + Number(metric.click_count));
    }
    const links = (data ?? []).map(({ smart_link_destinations, ...link }) => {
      const views = viewsByLink.get(link.id) ?? 0;
      const clicks = clicksByLink.get(link.id) ?? 0;
      return { ...link, destinations: smart_link_destinations ?? [], statistics: { clicks, ctr: views ? (clicks / views) * 100 : 0, views } };
    });
    return smartLinkResponse({ links, canManage: role !== "viewer", workspaceId });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Smart Links are unavailable.") }, errorStatus(error));
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginSmartLinkWrite(request)) return smartLinkResponse({ error: "Unauthorized request." }, 401);
  try {
    const { serviceClient, workspaceId, user } = await requireSmartLinkManager(request);
    const body = await request.json() as Record<string, unknown>;
    const patch = normalizeLinkPatch({
      ...body,
      slug: body.slug ?? normalizeSlug(undefined, body.titleOverride),
      destinations: normalizeDestinations(body.destinations, { requireOne: true })
    });
    const { data, error } = await serviceClient.rpc("smart_link_management_mutate", {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_action: "create",
      p_link_id: null,
      p_expected_updated_at: null,
      p_payload: patch
    });
    if (error) throw error;
    return smartLinkResponse({ smartLink: data }, 201);
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Smart Link creation failed.") }, errorStatus(error));
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";
import { compositionForVideo, validateOverlayComposition } from "@/lib/studio/overlays";
import { authorizeOverlaySources, overlayPreviewRasters } from "@/lib/server/studio-overlays";
import { sameOrigin, failure } from "@/lib/server/studio-overlay-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const composition = validateOverlayComposition((await request.json()).composition);
    if (!composition) return NextResponse.json({ error: "Invalid overlay composition." }, { status: 400 });
    await authorizeOverlaySources(serviceClient, workspaceId, composition);
    const [layers, sets] = await Promise.all([
      overlayPreviewRasters(workspaceId, composition),
      Promise.all((composition.videoSets ?? []).map(async (set) => [set.videoKey, await overlayPreviewRasters(workspaceId, compositionForVideo(composition, set.videoKey))] as const))
    ]);
    return NextResponse.json({ layers, videoLayers: Object.fromEntries(sets) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return failure(e); }
}

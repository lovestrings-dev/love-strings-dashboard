import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";
import { validateOverlayComposition } from "@/lib/studio/overlays";
import { authorizeOverlaySources } from "@/lib/server/studio-overlays";
import { sameOrigin, failure } from "@/lib/server/studio-overlay-http";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("studio_workspace_selection_drafts").select("overlay_composition,overlay_revision").eq("workspace_id", workspaceId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ composition: data?.overlay_composition ?? null, revision: data?.overlay_revision ?? 0, canEdit: role !== "viewer" }, { headers });
  } catch (e) { return failure(e); }
}
export async function PATCH(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId, role, user } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot edit overlays." }, { status: 403 });
    const body = await request.json(); const composition = validateOverlayComposition(body.composition);
    if (!composition || !Number.isSafeInteger(body.revision) || body.revision < 0) return NextResponse.json({ error: "Invalid overlay composition." }, { status: 400 });
    await authorizeOverlaySources(serviceClient, workspaceId, composition);
    const { error: initError } = await serviceClient.from("studio_workspace_selection_drafts").upsert({ workspace_id: workspaceId }, { onConflict: "workspace_id", ignoreDuplicates: true });
    if (initError) throw initError;
    const { data, error } = await serviceClient.from("studio_workspace_selection_drafts").update({ overlay_composition: composition, overlay_revision: body.revision + 1, updated_by: user.id }).eq("workspace_id", workspaceId).eq("overlay_revision", body.revision).select("overlay_composition,overlay_revision").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Overlays changed on another device. Reload to use the latest version." }, { status: 409 });
    return NextResponse.json({ composition: data.overlay_composition, revision: data.overlay_revision }, { headers });
  } catch (e) { return failure(e); }
}

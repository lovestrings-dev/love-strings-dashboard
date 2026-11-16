import { NextResponse, type NextRequest } from "next/server";
import { studioStagingBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await context.params;
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("studio_workspace_video_assets").select("object_path, mime_type").eq("workspace_id", workspaceId).eq("id", assetId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Studio video was not found." }, { status: 404 });
    const storage = await studioStorage();
    const [url] = await storage.bucket(studioStagingBucketName()).file(data.object_path).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000, responseType: data.mime_type, version: "v4" });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Studio video preview failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }
}

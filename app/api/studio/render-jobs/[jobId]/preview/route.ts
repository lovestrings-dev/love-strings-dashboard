import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { studioRenderBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { isStudioUuid } from "@/lib/studio/render-request";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { jobId } = await context.params;
    if (!isStudioUuid(jobId)) return NextResponse.json({ error: "Invalid render." }, { status: 400 });
    const { data: job, error } = await serviceClient.from("studio_render_jobs").select("status").eq("workspace_id", workspaceId).eq("id", jobId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!job || job.status !== "succeeded") return NextResponse.json({ error: "Rendered video is not available." }, { status: 404 });
    const { data: asset, error: assetError } = await serviceClient.from("studio_rendered_assets").select("object_path").eq("workspace_id", workspaceId).eq("render_job_id", jobId).maybeSingle();
    if (assetError) throw assetError;
    if (!asset || !asset.object_path.startsWith(`workspaces/${workspaceId}/studio/renders/${jobId}/`)) return NextResponse.json({ error: "Rendered video is not available." }, { status: 404 });
    const storage = await studioStorage();
    const [url] = await storage.bucket(studioRenderBucketName()).file(asset.object_path).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000, version: "v4", responseType: "video/mp4", ...(request.nextUrl.searchParams.get("download") === "1" ? { responseDisposition: `attachment; filename="ArtistDeck-${jobId}.mp4"` } : {}) });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : "Private render preview is unavailable." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }
}

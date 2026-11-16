import { NextResponse, type NextRequest } from "next/server";
import { studioStagingBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { canManageStudioRenders } from "@/lib/server/studio-render-access";
import { isStudioUuid } from "@/lib/studio/render-request";

export async function DELETE(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId, user, role } = await requireWorkspaceAccess(request);
    if (!canManageStudioRenders(user, role)) return NextResponse.json({ error: "Only the proof-of-concept owner can delete shared videos." }, { status: 403 });
    const { assetId } = await context.params;
    if (!isStudioUuid(assetId)) return NextResponse.json({ error: "Invalid shared video." }, { status: 400 });
    const { data: asset, error } = await serviceClient.from("studio_workspace_video_assets").select("object_path,deleted_at").eq("workspace_id", workspaceId).eq("id", assetId).maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: "Shared video not found." }, { status: 404 });
    const wasDeleted = Boolean(asset.deleted_at);
    const prefix = `workspaces/${workspaceId}/studio/uploads/${assetId}.`;
    if (!asset.object_path.startsWith(prefix) || !/^(mp4|mov|m4v|webm)$/i.test(asset.object_path.slice(prefix.length))) throw new Error("Invalid shared video path.");
    async function hasActiveRender() {
      const { data, error: activeError } = await serviceClient.from("studio_render_jobs").select("id").eq("workspace_id", workspaceId).in("status", ["queued", "running"]).limit(1);
      if (activeError) throw activeError;
      return Boolean(data?.length);
    }
    if (await hasActiveRender()) return NextResponse.json({ error: "Wait for rendering to finish before deleting shared footage." }, { status: 409 });
    const { error: markError } = await serviceClient.from("studio_workspace_video_assets").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", assetId);
    if (markError) throw markError;
    // A render reserves its slot then rechecks this marker. Recheck the slot
    // here too, so a racing generation can never lose its input mid-execution.
    if (await hasActiveRender()) {
      if (!wasDeleted) {
        const { error: restoreError } = await serviceClient.from("studio_workspace_video_assets").update({ deleted_at: null }).eq("workspace_id", workspaceId).eq("id", assetId);
        if (restoreError) throw restoreError;
      }
      return NextResponse.json({ error: "Rendering just started. Try deleting after it finishes." }, { status: 409 });
    }
    const storage = await studioStorage();
    await storage.bucket(studioStagingBucketName()).file(asset.object_path).delete({ ignoreNotFound: true });
    const { error: draftError } = await serviceClient.rpc("studio_remove_deleted_video_from_draft", { p_workspace_id: workspaceId, p_asset_id: assetId });
    if (draftError) throw draftError;
    return NextResponse.json({ deleted: true });
  } catch (error) { return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : "Shared video deletion did not finish. Retry before uploading it again." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }
}

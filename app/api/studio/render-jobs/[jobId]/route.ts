import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { isStudioUuid } from "@/lib/studio/render-request";
import { canManageStudioRenders } from "@/lib/server/studio-render-access";
import { deleteStudioRenderObject } from "@/lib/server/studio-media-retention";

export async function DELETE(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId, role, user } = await requireWorkspaceAccess(request);
    if (!canManageStudioRenders(user, role)) return NextResponse.json({ error: "Only the proof-of-concept owner can delete renders." }, { status: 403 });
    const { jobId } = await context.params;
    if (!isStudioUuid(jobId)) return NextResponse.json({ error: "Invalid render." }, { status: 400 });
    const { data: job, error } = await serviceClient.from("studio_render_jobs").select("id,status,deleted_at,output_object_path").eq("workspace_id", workspaceId).eq("id", jobId).maybeSingle();
    if (error) throw error;
    if (!job) return NextResponse.json({ error: "Render not found." }, { status: 404 });
    if (["queued", "running"].includes(job.status)) return NextResponse.json({ error: "Wait for this render to finish before deleting it." }, { status: 409 });
    await deleteStudioRenderObject(workspaceId, jobId, job.output_object_path);
    // Keep the audit row while physically removing the cloud output.
    if (!job.deleted_at) {
      const { error: updateError } = await serviceClient.from("studio_render_jobs").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", jobId).in("status", ["succeeded", "failed", "cancelled"]);
      if (updateError) throw updateError;
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : "The render could not be deleted." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

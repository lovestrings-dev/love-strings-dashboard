import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { studioRenderBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { isStudioUuid } from "@/lib/studio/render-request";
import { streamVideoZip, validateZipVideos } from "@/lib/server/studio-download-zip";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  try {
    // Download access follows preview access, including non-owner workspace users.
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const ids = request.nextUrl.searchParams.getAll("id");
    if (!ids.length || ids.length > 8 || new Set(ids).size !== ids.length || !ids.every(isStudioUuid)) return NextResponse.json({ error: "Choose up to eight completed videos." }, { status: 400 });
    const { data: jobs, error } = await serviceClient.from("studio_render_jobs").select("id").eq("workspace_id", workspaceId).eq("status", "succeeded").is("deleted_at", null).in("id", ids);
    if (error) throw error;
    if (jobs?.length !== ids.length) return NextResponse.json({ error: "Some videos are no longer available. Refresh Preview." }, { status: 404 });
    const { data: assets, error: assetError } = await serviceClient.from("studio_rendered_assets").select("render_job_id,object_path").eq("workspace_id", workspaceId).in("render_job_id", ids);
    if (assetError) throw assetError;
    const paths = ids.map(id => assets?.find(asset => asset.render_job_id === id)?.object_path as string | undefined);
    if (paths.some((path, index) => !path || !path.startsWith(`workspaces/${workspaceId}/studio/renders/${ids[index]}/`))) return NextResponse.json({ error: "Some videos are no longer available. Refresh Preview." }, { status: 404 });
    const storage = await studioStorage();
    const bucket = storage.bucket(studioRenderBucketName());
    const files = await Promise.all(paths.map(async (path, index) => {
      const object = bucket.file(path!);
      const [metadata] = await object.getMetadata();
      return { name: `Video-${index + 1}.mp4`, size: Number(metadata.size), open: () => object.createReadStream() };
    }));
    try { validateZipVideos(files); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid video archive." }, { status: 400 }); }
    const stream = Readable.toWeb(Readable.from(streamVideoZip(files)));
    return new Response(stream as ReadableStream<Uint8Array>, { headers: {
      "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="ArtistDeck-videos.zip"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : "Video download is unavailable. Refresh Preview and try again." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

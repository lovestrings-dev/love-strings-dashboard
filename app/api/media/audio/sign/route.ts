import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { createCloudinaryAudioSignature, validateAudioUploadRequest } from "../../audio-upload";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { role, serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot upload workspace audio." }, { status: 403 });
    const validation = validateAudioUploadRequest(await request.json(), false);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { data: song, error: songError } = await serviceClient.from("production_songs").select("id").eq("id", validation.productionSongId).eq("workspace_id", workspaceId).single();
    if (songError || !song) return NextResponse.json({ error: "The Production song was not found in this workspace." }, { status: 404 });
    const { data: workspace, error: workspaceError } = await serviceClient.from("app_workspaces").select("name").eq("id", workspaceId).single();
    if (workspaceError || !workspace) throw workspaceError ?? new Error("Workspace was not found.");
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary uploads are not configured. Ask a workspace Admin to add the server Cloudinary credentials.");
    return NextResponse.json({ apiKey, cloudName, ...createCloudinaryAudioSignature({ apiSecret, workspaceId, workspaceName: workspace.name }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare MP3 upload." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function isSameOrigin(request: NextRequest) {
  try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; }
}

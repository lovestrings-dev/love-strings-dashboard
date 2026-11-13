import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { validateAudioUploadRequest } from "../audio-upload";

type AudioRegistration = { byteSize?: unknown; fileName?: unknown; mimeType?: unknown; productionSongId?: unknown; url?: unknown };

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { role, serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot upload workspace audio." }, { status: 403 });
    const validation = validateAudioUploadRequest(await request.json() as AudioRegistration);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { data: song, error: songError } = await serviceClient.from("production_songs").select("id, title").eq("id", validation.productionSongId).eq("workspace_id", workspaceId).single();
    if (songError || !song) throw new Error("The Production song was not found in this workspace.");
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadedUrl = validation.url;
    if (!cloudName || typeof uploadedUrl !== "string" || !isWorkspaceAudioUrl(uploadedUrl, cloudName, workspaceId)) return NextResponse.json({ error: "The uploaded MP3 could not be verified for this workspace." }, { status: 400 });
    const { data: project, error: projectError } = await serviceClient.from("studio_projects").upsert({ production_song_id: song.id, title: song.title, workspace_id: workspaceId }, { onConflict: "workspace_id,production_song_id" }).select("id").single();
    if (projectError || !project) throw projectError ?? new Error("Studio project could not be created.");
    const { error: retireError } = await serviceClient.from("studio_audio_assets").update({ is_current: false }).eq("studio_project_id", project.id).eq("asset_kind", "song-source").eq("is_current", true);
    if (retireError) throw retireError;
    const { data: asset, error: assetError } = await serviceClient.from("studio_audio_assets").insert({ asset_kind: "song-source", byte_size: validation.byteSize, cloudinary_url: uploadedUrl, mime_type: validation.mimeType, original_file_name: validation.fileName, studio_project_id: project.id, workspace_id: workspaceId }).select("id").single();
    if (assetError || !asset) throw assetError ?? new Error("Studio audio metadata could not be saved.");
    return NextResponse.json({ assetId: asset.id, fileName: validation.fileName, url: uploadedUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio upload failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function isWorkspaceAudioUrl(value: string, cloudName: string, workspaceId: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.host === "res.cloudinary.com" && url.pathname.startsWith(`/${cloudName}/video/upload/`) && url.pathname.includes(`/workspaces/${workspaceId}/production/audio/`); } catch { return false; }
}

function isSameOrigin(request: NextRequest) {
  try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; }
}

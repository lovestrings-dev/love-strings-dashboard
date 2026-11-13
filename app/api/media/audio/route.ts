import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const maximumFileSize = 25 * 1024 * 1024;
const allowedMimeTypes = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg"]);

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { role, serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot upload workspace audio." }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    const productionSongId = form.get("productionSongId");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an MP3 file." }, { status: 400 });
    if (typeof productionSongId !== "string" || !isUuid(productionSongId)) {
      return NextResponse.json({ error: "Save the Production song before uploading its MP3." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".mp3") || !allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: "Use an MP3 audio file." }, { status: 400 });
    }
    if (file.size === 0 || file.size > maximumFileSize) {
      return NextResponse.json({ error: "MP3 files must be no larger than 25 MB." }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary uploads are not configured. Ask a workspace Admin to add the server Cloudinary credentials.");

    const { data: workspace, error: workspaceError } = await serviceClient
      .from("app_workspaces").select("name").eq("id", workspaceId).single();
    if (workspaceError) throw workspaceError;
    const { data: song, error: songError } = await serviceClient
      .from("production_songs").select("id, title").eq("id", productionSongId).eq("workspace_id", workspaceId).single();
    if (songError || !song) throw new Error("The Production song was not found in this workspace.");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `workspaces/${workspaceId}/production/audio`;
    const publicId = randomUUID();
    const context = `workspace_id=${workspaceId}|workspace_name=${sanitizeContextValue(workspace.name)}|asset_class=production_audio|source=artistdeck`;
    const tags = `artistdeck,workspace-${workspaceId},module-production,audio`;
    const signature = signUpload({ context, folder, public_id: publicId, tags, timestamp }, apiSecret);
    const cloudinaryForm = new FormData();
    cloudinaryForm.set("api_key", apiKey);
    cloudinaryForm.set("context", context);
    cloudinaryForm.set("file", file);
    cloudinaryForm.set("folder", folder);
    cloudinaryForm.set("public_id", publicId);
    cloudinaryForm.set("signature", signature);
    cloudinaryForm.set("tags", tags);
    cloudinaryForm.set("timestamp", String(timestamp));
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, { method: "POST", body: cloudinaryForm });
    const result = await response.json() as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Cloudinary audio upload failed.");
    const { data: project, error: projectError } = await serviceClient.from("studio_projects")
      .upsert({ production_song_id: song.id, title: song.title, workspace_id: workspaceId }, { onConflict: "workspace_id,production_song_id" })
      .select("id").single();
    if (projectError || !project) throw projectError ?? new Error("Studio project could not be created.");
    const { error: retireError } = await serviceClient.from("studio_audio_assets")
      .update({ is_current: false }).eq("studio_project_id", project.id).eq("asset_kind", "song-source").eq("is_current", true);
    if (retireError) throw retireError;
    const { data: asset, error: assetError } = await serviceClient.from("studio_audio_assets")
      .insert({ asset_kind: "song-source", byte_size: file.size, cloudinary_url: result.secure_url, mime_type: file.type || "audio/mpeg", original_file_name: file.name, studio_project_id: project.id, workspace_id: workspaceId })
      .select("id").single();
    if (assetError || !asset) throw assetError ?? new Error("Studio audio metadata could not be saved.");
    return NextResponse.json({ assetId: asset.id, fileName: file.name, url: result.secure_url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio upload failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function signUpload(parameters: Record<string, string | number>, secret: string) {
  const serialized = Object.entries(parameters).sort(([first], [second]) => first.localeCompare(second)).map(([key, value]) => `${key}=${value}`).join("&");
  return createHash("sha1").update(`${serialized}${secret}`).digest("hex");
}

function sanitizeContextValue(value: string) {
  return value.trim().replace(/[|=\\]/g, " ").slice(0, 250) || "Unnamed workspace";
}

function isSameOrigin(request: NextRequest) {
  try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

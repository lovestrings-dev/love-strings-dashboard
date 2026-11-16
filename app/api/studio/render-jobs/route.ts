import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { studioStagingBucketName, studioStorage } from "@/lib/server/adstudio-storage";
import { dispatchStudioRender, refreshStudioRenderJob, toStudioRenderReply, type StudioRenderJob } from "@/lib/server/studio-render-jobs";
import { isStudioUuid, renderObjectPaths, validateRenderRequest } from "@/lib/studio/render-request";

export const runtime = "nodejs";
export const maxDuration = 120;
const jobColumns = "id,workspace_id,studio_project_id,status,provider_execution_id,output_object_path,failure_message,created_at,result_details,deleted_at";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const id = request.nextUrl.searchParams.get("id");
    if (id && !isStudioUuid(id)) return NextResponse.json({ error: "Invalid render job." }, { status: 400 });
    let query = serviceClient.from("studio_render_jobs").select(jobColumns).eq("workspace_id", workspaceId).is("deleted_at", null);
    if (id) query = query.eq("id", id);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(id ? 1 : 40);
    if (error) throw error;
    // Refresh at most one active operation, including after a browser reload.
    const jobs = [];
    for (const row of data ?? []) jobs.push(toStudioRenderReply(await refreshStudioRenderJob(serviceClient, row as StudioRenderJob)));
    return NextResponse.json({ jobs, canGenerate: process.env.ADSTUDIO_RENDER_ENABLED === "true" && role !== "viewer" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorReply(error); }
}

export async function POST(request: NextRequest) {
  let reservedId: string | undefined;
  let access: Awaited<ReturnType<typeof requireWorkspaceAccess>> | undefined;
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    access = await requireWorkspaceAccess(request);
    const { serviceClient, workspaceId, role, user } = access;
    if (role === "viewer") return NextResponse.json({ error: "Viewers cannot generate videos." }, { status: 403 });
    // Explicit activation only after the updated worker and job IAM are ready.
    if (process.env.ADSTUDIO_RENDER_ENABLED !== "true") return NextResponse.json({ error: "Video generation is not enabled yet." }, { status: 503 });
    const input = validateRenderRequest(await request.json());
    if (!input) return NextResponse.json({ error: "Choose one audio snippet covering the output duration and one shared video snippet." }, { status: 400 });
    const { data: previous, error: previousError } = await serviceClient.from("studio_render_jobs").select(jobColumns).eq("workspace_id", workspaceId).eq("id", input.requestId).maybeSingle();
    if (previousError) throw previousError;
    if (previous?.deleted_at) return NextResponse.json({ error: "This render was deleted. Start a new batch." }, { status: 410 });
    if (previous) return NextResponse.json({ job: toStudioRenderReply(previous as StudioRenderJob) });
    const { data: active, error: activeError } = await serviceClient.from("studio_render_jobs").select("id").eq("workspace_id", workspaceId).in("status", ["queued", "running"]).limit(1);
    if (activeError) throw activeError;
    if (active?.length) return NextResponse.json({ error: "A video is already being generated in this workspace. Refresh its status first." }, { status: 409 });
    const { data: project, error: projectError } = await serviceClient.from("studio_projects").select("id,title").eq("workspace_id", workspaceId).eq("production_song_id", input.songId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: "The chosen audio is not available in this workspace." }, { status: 404 });
    const [{ data: audio, error: audioError }, { data: video, error: videoError }] = await Promise.all([
      serviceClient.from("studio_audio_assets").select("id,cloudinary_url").eq("workspace_id", workspaceId).eq("studio_project_id", project.id).eq("asset_kind", "song-source").eq("is_current", true).maybeSingle(),
      serviceClient.from("studio_workspace_video_assets").select("id,object_path,duration_seconds,original_file_name").eq("workspace_id", workspaceId).eq("id", input.videoAssetId).maybeSingle()
    ]);
    if (audioError || videoError) throw audioError ?? videoError;
    if (!audio || !video || input.videoEnd > Number(video.duration_seconds) + 0.05 || !video.object_path.startsWith(`workspaces/${workspaceId}/studio/uploads/`)) return NextResponse.json({ error: "The chosen source or trim is unavailable." }, { status: 400 });
    if (audio.cloudinary_url !== input.audioSourceUrl) return NextResponse.json({ error: "The audio source has changed. Select a new snippet from Audio first." }, { status: 409 });
    const audioUrl = new URL(audio.cloudinary_url);
    if (audioUrl.protocol !== "https:" || audioUrl.hostname !== "res.cloudinary.com" || audioUrl.username || audioUrl.password || audioUrl.port || !process.env.CLOUDINARY_CLOUD_NAME || audioUrl.pathname.split("/")[1] !== process.env.CLOUDINARY_CLOUD_NAME) throw new Error("Audio source is not managed by this Studio.");
    const paths = renderObjectPaths(workspaceId, input.requestId);
    const resultDetails = { songId: input.songId, videoAssetId: input.videoAssetId, audioTitle: project.title, audioStart: input.audioStart, audioEnd: input.audioEnd, videoName: video.original_file_name, videoStart: input.videoStart, videoEnd: input.videoEnd, durationSeconds: input.durationSeconds };
    const { data: reserved, error: reserveError } = await serviceClient.from("studio_render_jobs").insert({ id: input.requestId, workspace_id: workspaceId, studio_project_id: project.id, requested_by: user.id, status: "queued", manifest_object_path: paths.manifest, output_object_path: paths.output, result_details: resultDetails }).select(jobColumns).single();
    if (reserveError?.code === "23505") return NextResponse.json({ error: "A render request already exists. Refresh the render list." }, { status: 409 });
    if (reserveError) throw reserveError;
    reservedId = input.requestId;
    const storage = await studioStorage();
    const bucket = studioStagingBucketName();
    await storage.bucket(bucket).file(video.object_path).getMetadata();
    const response = await fetch(audioUrl, { redirect: "error", signal: AbortSignal.timeout(45000) });
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 50 * 1024 * 1024) throw new Error("The audio source could not be staged.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > 50 * 1024 * 1024) { await reader.cancel(); throw new Error("The audio source exceeds the render staging limit."); }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    if (!bytes) throw new Error("The audio source is empty.");
    await storage.bucket(bucket).file(paths.audio).save(Buffer.concat(chunks), { resumable: false, contentType: "audio/mpeg", preconditionOpts: { ifGenerationMatch: 0 } });
    const renderBucket = process.env.ADSTUDIO_RENDER_BUCKET;
    if (!renderBucket) throw new Error("Render bucket is not configured.");
    const manifest = { render_id: input.requestId, video_uri: `gs://${bucket}/${video.object_path}`, audio_uri: `gs://${bucket}/${paths.audio}`, output_uri: `gs://${renderBucket}/${paths.output}`, duration_seconds: input.durationSeconds, audio_start_seconds: input.audioStart, audio_end_seconds: input.audioEnd, video_start_seconds: input.videoStart, video_end_seconds: input.videoEnd, overlay: {} };
    await storage.bucket(bucket).file(paths.manifest).save(JSON.stringify(manifest), { resumable: false, contentType: "application/json", preconditionOpts: { ifGenerationMatch: 0 } });
    const operation = await dispatchStudioRender(`gs://${bucket}/${paths.manifest}`);
    const { data: running, error: runningError } = await serviceClient.from("studio_render_jobs").update({ status: "running", provider_execution_id: operation, started_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", input.requestId).select(jobColumns).single();
    if (runningError) throw runningError;
    return NextResponse.json({ job: toStudioRenderReply((running ?? reserved) as StudioRenderJob) }, { status: 202 });
  } catch (error) {
    if (reservedId && access) await access.serviceClient.from("studio_render_jobs").update({ status: "failed", failure_message: "Render submission failed. Check the execution history before submitting again.", completed_at: new Date().toISOString() }).eq("workspace_id", access.workspaceId).eq("id", reservedId);
    return errorReply(error);
  }
}

function sameOrigin(request: NextRequest) { try { return Boolean(request.headers.get("origin") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; } }
function errorReply(error: unknown) { console.error("Studio render request failed", { name: error instanceof Error ? error.name : "Unknown" }); return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : "Studio rendering could not complete this request." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }

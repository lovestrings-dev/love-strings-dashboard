import { NextResponse, type NextRequest } from "next/server";
import { validateComposition } from "@/lib/studio/composition";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!isUuid(projectId)) return reply({ error: "A Studio project is required." }, 400);
    const { data: project, error } = await serviceClient.from("studio_projects").select("id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle();
    if (error) throw error;
    if (!project) return reply({ error: "Studio project not found." }, 404);
    const [compositionResult, audioResult, videoResult] = await Promise.all([
      serviceClient.from("studio_project_compositions").select("schema_version, duration_seconds, format, overlay").eq("studio_project_id", projectId).eq("workspace_id", workspaceId).maybeSingle(),
      serviceClient.from("studio_audio_snippets").select("id, source_asset_id, start_seconds, end_seconds, sort_order").eq("studio_project_id", projectId).eq("workspace_id", workspaceId).order("sort_order"),
      serviceClient.from("studio_video_snippets").select("id, source_asset_id, start_seconds, end_seconds, sort_order").eq("studio_project_id", projectId).eq("workspace_id", workspaceId).order("sort_order")
    ]);
    if (compositionResult.error || audioResult.error || videoResult.error) throw compositionResult.error ?? audioResult.error ?? videoResult.error;
    if (!compositionResult.data) return NextResponse.json({ composition: null });
    return NextResponse.json({ composition: {
      schemaVersion: compositionResult.data.schema_version,
      projectId,
      durationSeconds: compositionResult.data.duration_seconds,
      format: compositionResult.data.format,
      overlay: compositionResult.data.overlay,
      audio: (audioResult.data ?? []).map(toSnippet),
      video: (videoResult.data ?? []).map(toSnippet)
    } });
  } catch (error) { return errorReply(error); }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return reply({ error: "Unauthorized request." }, 401);
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return reply({ error: "Viewers cannot edit Studio compositions." }, 403);
    const parsed = validateComposition(await request.json());
    if (!parsed.value) return reply({ error: parsed.error }, 400);
    const composition = parsed.value;
    const { data: project, error: projectError } = await serviceClient.from("studio_projects").select("id").eq("id", composition.projectId).eq("workspace_id", workspaceId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return reply({ error: "Studio project not found." }, 404);
    const sourceIds = [...composition.audio, ...composition.video].map((snippet) => snippet.sourceAssetId);
    const [{ data: audioAssets, error: audioError }, { data: videoAssets, error: videoError }] = await Promise.all([
      serviceClient.from("studio_audio_assets").select("id").eq("workspace_id", workspaceId).eq("studio_project_id", composition.projectId).in("id", composition.audio.map((snippet) => snippet.sourceAssetId)),
      serviceClient.from("studio_video_assets").select("id").eq("workspace_id", workspaceId).eq("studio_project_id", composition.projectId).in("id", composition.video.map((snippet) => snippet.sourceAssetId))
    ]);
    if (audioError || videoError) throw audioError ?? videoError;
    if ((audioAssets?.length ?? 0) !== composition.audio.length || (videoAssets?.length ?? 0) !== composition.video.length || new Set(sourceIds).size !== sourceIds.length) return reply({ error: "A selected source asset is not available in this Studio project." }, 400);
    const { error: compositionError } = await serviceClient.from("studio_project_compositions").upsert({ workspace_id: workspaceId, studio_project_id: composition.projectId, schema_version: 1, duration_seconds: composition.durationSeconds, format: composition.format, overlay: composition.overlay, updated_by: user.id }, { onConflict: "studio_project_id" });
    if (compositionError) throw compositionError;
    const { error: deleteAudioError } = await serviceClient.from("studio_audio_snippets").delete().eq("workspace_id", workspaceId).eq("studio_project_id", composition.projectId);
    const { error: deleteVideoError } = await serviceClient.from("studio_video_snippets").delete().eq("workspace_id", workspaceId).eq("studio_project_id", composition.projectId);
    if (deleteAudioError || deleteVideoError) throw deleteAudioError ?? deleteVideoError;
    const { error: insertAudioError } = await serviceClient.from("studio_audio_snippets").insert(composition.audio.map((snippet) => ({ workspace_id: workspaceId, studio_project_id: composition.projectId, source_asset_id: snippet.sourceAssetId, start_seconds: snippet.startSeconds, end_seconds: snippet.endSeconds, sort_order: snippet.sortOrder, created_by: user.id })));
    const { error: insertVideoError } = await serviceClient.from("studio_video_snippets").insert(composition.video.map((snippet) => ({ workspace_id: workspaceId, studio_project_id: composition.projectId, source_asset_id: snippet.sourceAssetId, start_seconds: snippet.startSeconds, end_seconds: snippet.endSeconds, sort_order: snippet.sortOrder, is_selected: true, created_by: user.id })));
    if (insertAudioError || insertVideoError) throw insertAudioError ?? insertVideoError;
    return NextResponse.json({ composition });
  } catch (error) { return errorReply(error); }
}

function toSnippet(row: { id: string; source_asset_id: string; start_seconds: number; end_seconds: number; sort_order: number }) { return { id: row.id, sourceAssetId: row.source_asset_id, startSeconds: Number(row.start_seconds), endSeconds: Number(row.end_seconds), sortOrder: row.sort_order }; }
function isUuid(value: string | null): value is string { return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)); }
function isSameOrigin(request: NextRequest) { try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; } }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status }); }
function errorReply(error: unknown) { return reply({ error: error instanceof Error ? error.message : "Studio composition request failed." }, error instanceof WorkspaceAccessError ? error.status : 500); }

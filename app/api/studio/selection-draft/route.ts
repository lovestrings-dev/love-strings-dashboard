import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

type SelectionDraft = { audioSnippets: unknown[]; pixabayVideos: unknown[]; uploadedVideoSnippets: unknown[] };

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient
      .from("studio_workspace_selection_drafts")
      .select("audio_snippets, pixabay_video_snippets, uploaded_video_snippets")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    const snippets = Array.isArray(data?.uploaded_video_snippets) ? data.uploaded_video_snippets : [];
    const { data: assets, error: assetsError } = await serviceClient.from("studio_workspace_video_assets").select("id").eq("workspace_id", workspaceId).is("deleted_at", null);
    if (assetsError) throw assetsError;
    const available = new Set((assets ?? []).map((asset) => asset.id));
    return NextResponse.json({
      audioSnippets: Array.isArray(data?.audio_snippets) ? data.audio_snippets : [],
      pixabayVideos: Array.isArray(data?.pixabay_video_snippets) ? data.pixabay_video_snippets : [],
      uploadedVideoSnippets: snippets.filter((snippet: unknown) => isRecord(snippet) && available.has(snippet.assetId))
    } satisfies SelectionDraft);
  } catch (error) {
    return errorReply(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return reply({ error: "Unauthorized request." }, 401);
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return reply({ error: "Viewers cannot edit Studio selections." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const audioSnippets = body.audioSnippets;
    const pixabayVideos = body.pixabayVideos;
    const uploadedVideoSnippets = body.uploadedVideoSnippets;
    if (audioSnippets !== undefined && !isAudioSnippets(audioSnippets)) return reply({ error: "Invalid audio selections." }, 400);
    if (pixabayVideos !== undefined && !isPixabayVideos(pixabayVideos)) return reply({ error: "Invalid video selections." }, 400);
    if (uploadedVideoSnippets !== undefined && !isUploadedVideoSnippets(uploadedVideoSnippets)) return reply({ error: "Invalid uploaded-video selections." }, 400);
    if (Array.isArray(uploadedVideoSnippets) && uploadedVideoSnippets.length) {
      const ids = [...new Set(uploadedVideoSnippets.map((snippet: { assetId: string }) => snippet.assetId))];
      const { data: assets, error: assetsError } = await serviceClient.from("studio_workspace_video_assets").select("id").eq("workspace_id", workspaceId).in("id", ids).is("deleted_at", null);
      if (assetsError) throw assetsError;
      if ((assets ?? []).length !== ids.length) return reply({ error: "A selected video was deleted. Refresh Video before selecting again." }, 409);
    }
    if (audioSnippets === undefined && pixabayVideos === undefined && uploadedVideoSnippets === undefined) return reply({ error: "No Studio selections were supplied." }, 400);

    const { data: current, error: currentError } = await serviceClient
      .from("studio_workspace_selection_drafts")
      .select("audio_snippets, pixabay_video_snippets, uploaded_video_snippets")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (currentError) throw currentError;
    const { error } = await serviceClient.from("studio_workspace_selection_drafts").upsert({
      workspace_id: workspaceId,
      audio_snippets: audioSnippets ?? current?.audio_snippets ?? [],
      pixabay_video_snippets: pixabayVideos ?? current?.pixabay_video_snippets ?? [],
      uploaded_video_snippets: uploadedVideoSnippets ?? current?.uploaded_video_snippets ?? [],
      updated_by: user.id
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorReply(error);
  }
}

function isAudioSnippets(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= 12 && value.every((item) => {
    if (!isRecord(item)) return false;
    return typeof item.artworkUrl === "string" && typeof item.end === "number" && Number.isFinite(item.end) && typeof item.id === "string" && typeof item.songId === "string" && typeof item.sourceFileName === "string" && typeof item.sourceUrl === "string" && typeof item.start === "number" && Number.isFinite(item.start) && typeof item.title === "string" && item.end > item.start;
  });
}

function isPixabayVideos(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= 4 && value.every((item) => {
    if (!isRecord(item)) return false;
    return typeof item.creator === "string" && typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) && typeof item.height === "number" && Number.isInteger(item.height) && typeof item.id === "string" && typeof item.pageUrl === "string" && typeof item.previewUrl === "string" && typeof item.previewVideoUrl === "string" && typeof item.tags === "string" && typeof item.width === "number" && Number.isInteger(item.width);
  });
}

function isUploadedVideoSnippets(value: unknown): value is Array<{ assetId: string; start: number; end: number }> {
  return Array.isArray(value) && value.length <= 4 && value.every((item) => {
    if (!isRecord(item)) return false;
    return typeof item.assetId === "string" && /^[0-9a-f-]{36}$/i.test(item.assetId) && typeof item.end === "number" && Number.isFinite(item.end) && typeof item.start === "number" && Number.isFinite(item.start) && item.end > item.start;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSameOrigin(request: NextRequest) {
  try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; }
}

function reply(body: unknown, status = 200) { return NextResponse.json(body, { status }); }
function errorReply(error: unknown) { return reply({ error: error instanceof Error ? error.message : "Studio selection request failed." }, error instanceof WorkspaceAccessError ? error.status : 500); }

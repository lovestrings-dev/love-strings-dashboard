import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { studioStagingBucketName, studioStorage, workspaceVideoObjectPath } from "@/lib/server/adstudio-storage";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const runtime = "nodejs";

type UploadRequest = { action?: "complete" | "sign"; assetId?: unknown; durationSeconds?: unknown; fileName?: unknown; height?: unknown; mimeType?: unknown; size?: unknown; width?: unknown };

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("studio_workspace_video_assets")
      .select("id, original_file_name, mime_type, byte_size, duration_seconds, width, height, created_at")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(12);
    if (error) throw error;
    return NextResponse.json({ assets: (data ?? []).map(toAsset) });
  } catch (error) { return errorReply(error); }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return reply({ error: "Unauthorized request." }, 401);
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (role === "viewer") return reply({ error: "Viewers cannot upload workspace video." }, 403);
    const body = await request.json() as UploadRequest;
    const validation = validateUpload(body);
    if (validation.error) return reply({ error: validation.error }, 400);

    if (body.action === "sign") {
      const assetId = randomUUID();
      const objectPath = workspaceVideoObjectPath(workspaceId, assetId, fileExtension(validation.value.fileName));
      const storage = await studioStorage();
      const [uploadUrl] = await storage.bucket(studioStagingBucketName()).file(objectPath).getSignedUrl({
        action: "write", contentType: validation.value.mimeType, expires: Date.now() + 10 * 60 * 1000, version: "v4"
      });
      return NextResponse.json({ assetId, objectPath, uploadUrl });
    }

    if (body.action === "complete") {
      const assetId = typeof body.assetId === "string" && isUuid(body.assetId) ? body.assetId : "";
      if (!assetId) return reply({ error: "Invalid upload asset." }, 400);
      const objectPath = workspaceVideoObjectPath(workspaceId, assetId, fileExtension(validation.value.fileName));
      const storage = await studioStorage();
      const file = storage.bucket(studioStagingBucketName()).file(objectPath);
      const [metadata] = await file.getMetadata();
      const storedSize = Number(metadata.size ?? 0);
      const storedType = metadata.contentType ?? "";
      if (!storedSize || storedSize > 500 * 1024 * 1024 || storedSize !== validation.value.size || storedType !== validation.value.mimeType) {
        await file.delete({ ignoreNotFound: true });
        return reply({ error: "The uploaded video did not match the approved file details." }, 400);
      }
      const { data, error } = await serviceClient.from("studio_workspace_video_assets").insert({
        byte_size: storedSize, created_by: user.id, duration_seconds: validation.value.durationSeconds, height: validation.value.height,
        id: assetId, mime_type: validation.value.mimeType, object_path: objectPath, original_file_name: validation.value.fileName,
        width: validation.value.width, workspace_id: workspaceId
      }).select("id, original_file_name, mime_type, byte_size, duration_seconds, width, height, created_at").single();
      if (error) throw error;
      return NextResponse.json({ asset: toAsset(data) }, { status: 201 });
    }
    return reply({ error: "Choose an upload action." }, 400);
  } catch (error) { return errorReply(error); }
}

function validateUpload(body: UploadRequest) {
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 180) : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase() : "";
  const size = typeof body.size === "number" && Number.isInteger(body.size) ? body.size : 0;
  const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : 0;
  const width = typeof body.width === "number" && Number.isInteger(body.width) ? body.width : 0;
  const height = typeof body.height === "number" && Number.isInteger(body.height) ? body.height : 0;
  if (!fileName || !/\.(mp4|mov|m4v|webm)$/i.test(fileName) || !mimeType.startsWith("video/") || size < 1 || size > 500 * 1024 * 1024 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 1800 || width < 1 || height < 1) return { error: "Choose a video up to 500 MB with valid duration and dimensions." } as const;
  return { value: { durationSeconds, fileName, height, mimeType, size, width } } as const;
}
function fileExtension(fileName: string) { return fileName.split(".").pop() ?? "mp4"; }
function toAsset(row: { id: string; original_file_name: string; mime_type: string; byte_size: number; duration_seconds: number; width: number; height: number; created_at: string }) { return { createdAt: row.created_at, durationSeconds: Number(row.duration_seconds), fileName: row.original_file_name, height: row.height, id: row.id, mimeType: row.mime_type, size: Number(row.byte_size), width: row.width }; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isSameOrigin(request: NextRequest) { try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; } }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status }); }
function errorReply(error: unknown) { return reply({ error: error instanceof Error ? error.message : "Studio upload request failed." }, error instanceof WorkspaceAccessError ? error.status : 500); }

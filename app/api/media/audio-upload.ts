import { createHash, randomUUID } from "node:crypto";

export const maximumAudioFileSize = 25 * 1024 * 1024;
export const validAudioMimeTypes = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg"]);

export function validateAudioUploadRequest(payload: { byteSize?: unknown; fileName?: unknown; mimeType?: unknown; productionSongId?: unknown; url?: unknown }, requireUrl = true) {
  if (typeof payload.productionSongId !== "string" || !isUuid(payload.productionSongId)) return { error: "Save the Production song before uploading its MP3." };
  if (typeof payload.fileName !== "string" || !payload.fileName.toLowerCase().endsWith(".mp3") || typeof payload.mimeType !== "string" || !validAudioMimeTypes.has(payload.mimeType)) return { error: "Use an MP3 audio file." };
  if (typeof payload.byteSize !== "number" || !Number.isFinite(payload.byteSize) || payload.byteSize <= 0 || payload.byteSize > maximumAudioFileSize) return { error: "MP3 files must be no larger than 25 MB." };
  if (requireUrl && typeof payload.url !== "string") return { error: "The MP3 upload did not return a file URL." };
  return { byteSize: payload.byteSize, fileName: payload.fileName, mimeType: payload.mimeType, productionSongId: payload.productionSongId, url: payload.url as string };
}

export function createCloudinaryAudioSignature({ apiSecret, workspaceId, workspaceName }: { apiSecret: string; workspaceId: string; workspaceName: string }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `workspaces/${workspaceId}/production/audio`;
  const publicId = randomUUID();
  const context = `workspace_id=${sanitizeContextValue(workspaceId)}|workspace_name=${sanitizeContextValue(workspaceName)}|asset_class=production_audio|source=artistdeck`;
  const tags = `artistdeck,workspace-${workspaceId},module-production,audio`;
  const parameters = { context, folder, public_id: publicId, tags, timestamp };
  const serialized = Object.entries(parameters).sort(([first], [second]) => first.localeCompare(second)).map(([key, value]) => `${key}=${value}`).join("&");
  return { ...parameters, signature: createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex") };
}

function sanitizeContextValue(value: string) { return value.trim().replace(/[|=\\]/g, " ").slice(0, 250) || "Unnamed workspace"; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

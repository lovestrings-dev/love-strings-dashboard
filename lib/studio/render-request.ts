import { validateOverlaySnapshot, type OverlaySnapshot } from "./overlays.ts";
export type StudioRenderRequest = {
  overlaySnapshot?: OverlaySnapshot;
  includeOverlays?: boolean;
  overlaySetKey?: string;
  batchId?: string;
  startBatch?: boolean;
  requestId: string;
  songId: string;
  audioSourceUrl: string;
  audioStart: number;
  audioEnd: number;
  videoAssetId?: string;
  pixabayVideoId?: string;
  videoStart: number;
  videoEnd: number;
  durationSeconds: number;
};
export function isStudioUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function validateRenderRequest(value: unknown): StudioRenderRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const overlaySnapshot = v.overlaySnapshot === undefined ? undefined : validateOverlaySnapshot(v.overlaySnapshot);
  if (overlaySnapshot === null || (v.includeOverlays !== undefined && typeof v.includeOverlays !== "boolean")) return null;
  if (v.overlaySetKey !== undefined && (typeof v.overlaySetKey !== "string" || !/^(upload:[a-f0-9-]{36}|pixabay:[1-9][0-9]{0,11})$/.test(v.overlaySetKey) || v.includeOverlays === false || !overlaySnapshot?.composition.videoSets?.some(set => set.videoKey === v.overlaySetKey))) return null;
  if (v.batchId !== undefined && (!isStudioUuid(v.batchId) || typeof v.startBatch !== "boolean")) return null;
  if (![v.requestId, v.songId].every(isStudioUuid)) return null;
  if (v.pixabayVideoId !== undefined) {
    if (v.videoAssetId !== undefined || typeof v.pixabayVideoId !== "string" || !/^[1-9][0-9]{0,11}$/.test(v.pixabayVideoId)) return null;
  } else if (!isStudioUuid(v.videoAssetId)) return null;
  if (typeof v.audioSourceUrl !== "string" || v.audioSourceUrl.length > 2048 || !v.audioSourceUrl.startsWith("https://")) return null;
  for (const field of ["audioStart", "audioEnd", "videoStart", "videoEnd", "durationSeconds"]) {
    if (typeof v[field] !== "number" || !Number.isFinite(v[field]) || v[field] < 0 || v[field] > 1800) return null;
  }
  const r = v as unknown as StudioRenderRequest;
  if (!Number.isInteger(r.durationSeconds) || r.durationSeconds < 1 || r.durationSeconds > 180 || r.audioEnd <= r.audioStart || r.videoEnd <= r.videoStart || r.audioEnd - r.audioStart < r.durationSeconds - 0.05) return null;
  const result = Object.fromEntries(Object.keys({ requestId: 0, songId: 0, audioSourceUrl: 0, audioStart: 0, audioEnd: 0, videoStart: 0, videoEnd: 0, durationSeconds: 0 }).map((key) => [key, v[key]])) as StudioRenderRequest;
  if (v.pixabayVideoId !== undefined) result.pixabayVideoId = v.pixabayVideoId as string;
  else result.videoAssetId = v.videoAssetId as string;
  if (overlaySnapshot) result.overlaySnapshot = overlaySnapshot;
  if (v.includeOverlays !== undefined) result.includeOverlays = v.includeOverlays as boolean;
  if (v.overlaySetKey !== undefined) result.overlaySetKey = v.overlaySetKey as string;
  return v.batchId === undefined ? result : { ...result, batchId: v.batchId as string, startBatch: v.startBatch as boolean };
}

export function renderObjectPaths(workspaceId: string, renderId: string) {
  // Workspace IDs come from authorized database records and may predate RFC
  // version/variant UUID bits. Keep canonical UUID syntax to protect paths.
  const workspaceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!workspaceUuid.test(workspaceId) || !isStudioUuid(renderId)) throw new Error("Invalid render identity.");
  const root = `workspaces/${workspaceId}/studio/renders/${renderId}`;
  // Temporary audio/manifests use the existing lifecycle-managed prefixes.
  return { audio: `media/${root}/audio-source`, video: `media/${root}/pixabay-source.mp4`, manifest: `manifests/${root}/manifest.json`, output: `${root}/final.mp4` };
}

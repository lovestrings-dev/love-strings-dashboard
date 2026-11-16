export type StudioRenderRequest = {
  requestId: string;
  songId: string;
  audioSourceUrl: string;
  audioStart: number;
  audioEnd: number;
  videoAssetId: string;
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
  if (![v.requestId, v.songId, v.videoAssetId].every(isStudioUuid)) return null;
  if (typeof v.audioSourceUrl !== "string" || v.audioSourceUrl.length > 2048 || !v.audioSourceUrl.startsWith("https://")) return null;
  for (const field of ["audioStart", "audioEnd", "videoStart", "videoEnd", "durationSeconds"]) {
    if (typeof v[field] !== "number" || !Number.isFinite(v[field]) || v[field] < 0 || v[field] > 1800) return null;
  }
  const r = v as unknown as StudioRenderRequest;
  if (!Number.isInteger(r.durationSeconds) || r.durationSeconds < 1 || r.durationSeconds > 180 || r.audioEnd <= r.audioStart || r.videoEnd <= r.videoStart || r.audioEnd - r.audioStart < r.durationSeconds - 0.05) return null;
  return Object.fromEntries(Object.keys({ requestId: 0, songId: 0, audioSourceUrl: 0, audioStart: 0, audioEnd: 0, videoAssetId: 0, videoStart: 0, videoEnd: 0, durationSeconds: 0 }).map((key) => [key, v[key]])) as StudioRenderRequest;
}

export function renderObjectPaths(workspaceId: string, renderId: string) {
  // Workspace IDs come from authorized database records and may predate RFC
  // version/variant UUID bits. Keep canonical UUID syntax to protect paths.
  const workspaceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!workspaceUuid.test(workspaceId) || !isStudioUuid(renderId)) throw new Error("Invalid render identity.");
  const root = `workspaces/${workspaceId}/studio/renders/${renderId}`;
  // Temporary audio/manifests use the existing lifecycle-managed prefixes.
  return { audio: `media/${root}/audio-source`, manifest: `manifests/${root}/manifest.json`, output: `${root}/final.mp4` };
}

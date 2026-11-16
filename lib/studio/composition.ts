export const studioCompositionVersion = 1;
export const studioMaximumDurationSeconds = 180;

export type StudioOverlay = { imageAssetId?: string; text?: string; textColor?: string; fontSize?: number; position?: "top" | "center" | "bottom" };
export type StudioSnippet = { id: string; sourceAssetId: string; startSeconds: number; endSeconds: number; sortOrder: number };
export type StudioComposition = { schemaVersion: 1; projectId: string; durationSeconds: number; format: "vertical-9:16"; audio: StudioSnippet[]; video: StudioSnippet[]; overlay: StudioOverlay };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateComposition(value: unknown): { value?: StudioComposition; error?: string } {
  if (!isRecord(value) || value.schemaVersion !== studioCompositionVersion || !isUuid(value.projectId)) return { error: "Invalid Studio composition." };
  if (value.format !== "vertical-9:16" || !isDuration(value.durationSeconds)) return { error: "Studio exports must be vertical and 1–180 seconds." };
  const audio = validateSnippets(value.audio, "audio"); const video = validateSnippets(value.video, "video");
  if (typeof audio === "string") return { error: audio };
  if (typeof video === "string") return { error: video };
  if (audio.length !== 1 || video.length !== 1) return { error: "Select exactly one audio and one video snippet before rendering." };
  if (audio[0].endSeconds - audio[0].startSeconds < value.durationSeconds || video[0].endSeconds - video[0].startSeconds < value.durationSeconds) return { error: "Each selected snippet must cover the project duration." };
  const overlay = validateOverlay(value.overlay); if (typeof overlay === "string") return { error: overlay };
  return { value: { schemaVersion: 1, projectId: value.projectId, durationSeconds: value.durationSeconds, format: "vertical-9:16", audio, video, overlay } };
}

function validateSnippets(value: unknown, label: string): StudioSnippet[] | string {
  if (!Array.isArray(value)) return `Invalid ${label} snippets.`;
  const parsed: StudioSnippet[] = [];
  for (const item of value) {
    if (!isRecord(item)) return `Invalid ${label} snippet.`;
    const start = item.startSeconds; const end = item.endSeconds; const sortOrder = item.sortOrder;
    if (!isUuid(item.id) || !isUuid(item.sourceAssetId) || !isSeconds(start) || !isSeconds(end) || end <= start || typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0) return `Invalid ${label} snippet.`;
    parsed.push({ id: item.id, sourceAssetId: item.sourceAssetId, startSeconds: start, endSeconds: end, sortOrder });
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}
function validateOverlay(value: unknown): StudioOverlay | string {
  if (!isRecord(value)) return "Invalid overlay.";
  if (value.imageAssetId !== undefined && !isUuid(value.imageAssetId)) return "Invalid overlay image.";
  if (value.text !== undefined && (typeof value.text !== "string" || value.text.length > 280 || /[\x00-\x1F]/.test(value.text))) return "Overlay text must be 280 printable characters or fewer.";
  if (value.textColor !== undefined && (typeof value.textColor !== "string" || !/^#[0-9a-f]{6}$/i.test(value.textColor))) return "Overlay text colour must be a hex value.";
  const fontSize = value.fontSize;
  if (fontSize !== undefined && (typeof fontSize !== "number" || !Number.isInteger(fontSize) || fontSize < 12 || fontSize > 160)) return "Overlay font size must be 12–160.";
  if (value.position !== undefined && value.position !== "top" && value.position !== "center" && value.position !== "bottom") return "Invalid overlay position.";
  return Object.fromEntries(Object.entries({ imageAssetId: value.imageAssetId, text: value.text, textColor: value.textColor, fontSize: value.fontSize, position: value.position }).filter(([, entry]) => entry !== undefined)) as StudioOverlay;
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isUuid(value: unknown): value is string { return typeof value === "string" && uuid.test(value); }
function isSeconds(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1800; }
function isDuration(value: unknown): value is number { return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= studioMaximumDurationSeconds; }

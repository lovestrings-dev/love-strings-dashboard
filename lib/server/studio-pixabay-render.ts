import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { File } from "@google-cloud/storage";
import { normalizePixabayVideoSearch } from "../studio/pixabay";

// Only URLs returned by the provider's server-side ID lookup are eligible.
// Never download the URL persisted in the browser-editable selection draft.
export async function resolvePixabayRenderVideo(id: string) {
  if (!/^[1-9][0-9]{0,11}$/.test(id)) throw new Error("Invalid Pixabay video.");
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("Pixabay rendering is not configured.");
  const url = new URL("https://pixabay.com/api/videos/");
  url.search = new URLSearchParams({ key, id }).toString();
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000), next: { revalidate: 86400 } });
  if (!response.ok) throw new Error("Pixabay could not verify the selected video. Try again shortly.");
  const clip = normalizePixabayVideoSearch(await response.json(), "vertical").find((v) => v.id === id);
  if (!clip || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0 || clip.durationSeconds > 1800) throw new Error("The selected Pixabay video is no longer available in vertical format.");
  const source = new URL(clip.previewVideoUrl);
  if (source.protocol !== "https:" || source.hostname !== "cdn.pixabay.com" || source.port || source.username || source.password || !source.pathname.startsWith("/video/") || !source.pathname.endsWith(".mp4")) throw new Error("Unsupported Pixabay video source.");
  return clip;
}

export async function stagePixabayRenderVideo(url: string, file: File, maxBytes = 500 * 1024 * 1024) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) throw new Error("The Pixabay video could not be downloaded.");
  if (Number(response.headers.get("content-length")) > maxBytes) { await response.body.cancel(); throw new Error("The Pixabay video exceeds the 500 MB staging limit."); }
  let bytes = 0;
  const limit = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > maxBytes ? new Error("The Pixabay video exceeds the 500 MB staging limit.") : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), limit, file.createWriteStream({ resumable: false, contentType: "video/mp4", preconditionOpts: { ifGenerationMatch: 0 } }));
    if (!bytes) throw new Error("The Pixabay video is empty.");
  } catch (error) {
    // This is a new, request-scoped temporary object, never an uploaded asset.
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    throw error;
  }
}

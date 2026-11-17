import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OverlayComposition, OverlayLayer, OverlayRaster } from "../studio/overlays";
import { studioStagingBucketName, studioStorage } from "./adstudio-storage";

const limit = 10 * 1024 * 1024;
// Package the font and use a writable cache in local and serverless runtimes.
process.env.FONTCONFIG_FILE ??= path.join(process.cwd(), "public/studio/fonts.conf");
const cache = new Map<string, { bytes: Buffer; width: number; height: number }[]>();
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export async function authorizeOverlaySources(db: SupabaseClient, workspaceId: string, composition: OverlayComposition) {
  const allLayers = [...composition.layers, ...(composition.videoSets ?? []).flatMap((set) => set.layers)];
  const urls = allLayers.flatMap((l) => l.enabled && l.source?.kind === "artwork" ? [l.source.url] : []);
  if (urls.length) {
    const { data, error } = await db.from("production_songs").select("id,slug,album_art_url").eq("workspace_id", workspaceId).in("album_art_url", urls);
    if (error) throw error;
    for (const l of allLayers) { const source = l.source; if (l.enabled && source?.kind === "artwork" && !(data ?? []).some((s) => (s.id === source.songId || s.slug === source.songId) && s.album_art_url === source.url)) throw new Error("Choose artwork available in this workspace."); }
  }
  for (const l of allLayers) if (l.source?.kind === "upload" && !l.source.objectPath.startsWith(`workspaces/${workspaceId}/studio/overlay-assets/`)) throw new Error("Overlay image is outside this workspace.");
}
async function downloadArtwork(url: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com" || u.port || u.username || u.password) throw new Error("Unsupported artwork source.");
  const response = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error("Artwork could not be loaded.");
  if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new Error("Overlay image exceeds 10 MB."); }
  const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
  try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > limit) { await reader.cancel(); throw new Error("Overlay image exceeds 10 MB."); } chunks.push(r.value); } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function layerImage(layer: OverlayLayer) {
  if (layer.kind === "text") {
    const pad = Math.ceil(layer.fontSize * layer.scale * .12) + 4;
    const text = await sharp({ text: { text: `<span foreground="white" weight="bold">${escape(layer.text || " ")}</span>`, font: `Noto Sans Bold ${Math.round(layer.fontSize * layer.scale)}`, fontfile: path.join(process.cwd(), "public/studio/NotoSans.ttf"), rgba: true, dpi: 72, align: "centre", width: 1000 } }).png().toBuffer({ resolveWithObject: true });
    const width = text.info.width + 2 * pad, height = text.info.height + 2 * pad;
    const layers: sharp.OverlayOptions[] = [];
    if (layer.outline) layers.push({ input: await sharp(text.data).ensureAlpha().dilate(2).tint("#111111").png().toBuffer(), left: pad, top: pad });
    layers.push({ input: text.data, left: pad, top: pad });
    return sharp({ create: { width, height, channels: 4, background: layer.background ? { r: 8, g: 13, b: 16, alpha: .65 } : { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
  }
  let source: Buffer;
  if (layer.source?.kind === "platform-logos") source = await readFile(path.join(process.cwd(), "public/studio/platform-logos.svg"));
  else if (layer.source?.kind === "artwork") source = await downloadArtwork(layer.source.url);
  else if (layer.source?.kind === "upload") {
    const storage = await studioStorage(); const file = storage.bucket(studioStagingBucketName()).file(layer.source.objectPath);
    const [meta] = await file.getMetadata(); if (Number(meta.size) > limit) throw new Error("Overlay image exceeds 10 MB.");
    [source] = await file.download();
  } else throw new Error("Choose an overlay image.");
  const image = sharp(source, { limitInputPixels: 25_000_000, animated: false });
  const meta = await image.metadata();
  if (!["png", "jpeg", "webp", "gif", "svg"].includes(meta.format ?? "") || (meta.format === "svg" && layer.source?.kind !== "platform-logos")) throw new Error("Choose PNG, JPEG, WebP or GIF artwork.");
  return image.rotate().resize({ width: Math.min(1080, Math.round(1080 * layer.width / 100 * layer.scale)), height: 1920, fit: "inside" }).png().toBuffer();
}
export async function rasterizeOverlayLayers(workspaceId: string, composition: OverlayComposition) {
  const key = `${workspaceId}:${JSON.stringify(composition)}`;
  const enabled = composition.layers.filter((l) => l.enabled);
  let result = cache.get(key);
  if (!result) {
    result = [];
    for (const layer of enabled) {
      const rgba = await sharp(await layerImage(layer)).ensureAlpha().png().toBuffer();
      let image = sharp(rgba);
      if (layer.blur > 0) image = image.blur(Math.max(.3, layer.blur));
      const rendered = await image.linear([1, 1, 1, layer.opacity / 100], [0, 0, 0, 0]).png().toBuffer({ resolveWithObject: true });
      result.push({ bytes: rendered.data, width: rendered.info.width, height: rendered.info.height });
    }
    // Bounded warm-process cache; keys are workspace-scoped. Never cache credentials.
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
  }
  return result.map((image, index) => ({ ...image, layer: enabled[index] }));
}
export async function overlayPreviewRasters(workspaceId: string, composition: OverlayComposition): Promise<OverlayRaster[]> {
  return (await rasterizeOverlayLayers(workspaceId, composition)).map(({ layer, bytes, width, height }) => ({ id: layer.id, dataUrl: `data:image/png;base64,${bytes.toString("base64")}`, width, height }));
}
export async function stageOverlayLayers(workspaceId: string, renderId: string, composition: OverlayComposition, duration: number) {
  const storage = await studioStorage();
  const staged = [];
  for (const { layer, bytes } of await rasterizeOverlayLayers(workspaceId, composition)) {
    if (layer.start >= duration) continue;
    const objectPath = `media/workspaces/${workspaceId}/studio/renders/${renderId}/overlays/${layer.id}.png`;
    await storage.bucket(studioStagingBucketName()).file(objectPath).save(bytes, { resumable: false, contentType: "image/png", preconditionOpts: { ifGenerationMatch: 0 } });
    staged.push({ image_uri: `gs://${studioStagingBucketName()}/${objectPath}`, x: layer.x / 100, y: layer.y / 100, start_seconds: layer.start, end_seconds: Math.min(duration, layer.end) });
  }
  return staged;
}

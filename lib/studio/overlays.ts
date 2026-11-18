export type OverlaySource = { kind: "platform-logos" } | { kind: "artwork"; songId: string; url: string } | { kind: "upload"; objectPath: string };
export type OverlayLayer = {
  id: string; label: string; kind: "text" | "image"; enabled: boolean;
  x: number; y: number; width: number; scale: number; opacity: number; blur: number;
  start: number; end: number; text: string; fontSize: number; background: boolean; outline: boolean;
  source?: OverlaySource;
};
export type OverlayComposition = { schemaVersion: 2; layers: OverlayLayer[]; videoSets?: Array<{ videoKey: string; layers: OverlayLayer[] }> };
export type OverlaySnapshot = { revision: number; composition: OverlayComposition };
export type OverlayRaster = { id: string; dataUrl: string; width: number; height: number };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

export function validateOverlayComposition(value: unknown): OverlayComposition | null {
  if (!record(value) || value.schemaVersion !== 2 || !Array.isArray(value.layers) || value.layers.length > 8) return null;
  const ids = new Set<string>(); const layers: OverlayLayer[] = [];
  for (const l of value.layers) {
    if (!record(l) || typeof l.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(l.id) || ids.has(l.id) || typeof l.label !== "string" || l.label.length > 100 || !["text", "image"].includes(l.kind as string) || typeof l.enabled !== "boolean" || typeof l.background !== "boolean" || typeof l.outline !== "boolean" || typeof l.text !== "string" || l.text.length > 280 || /[\x00-\x08\x0B-\x1F]/.test(l.text)) return null;
    if (!finite(l.x, 0, 100) || !finite(l.y, 0, 100) || !finite(l.width, 1, 100) || !finite(l.scale, .1, 3) || !finite(l.opacity, 0, 100) || !finite(l.blur, 0, 30) || !finite(l.start, 0, 180) || !finite(l.end, 0, 180) || l.end <= l.start || !finite(l.fontSize, 12, 320)) return null;
    let source: OverlaySource | undefined;
    if (l.kind === "image") {
      if (!record(l.source)) return null;
      if (l.source.kind === "platform-logos") source = { kind: "platform-logos" };
      else if (l.source.kind === "artwork" && typeof l.source.songId === "string" && l.source.songId.length <= 100 && typeof l.source.url === "string" && l.source.url.length < 2048) {
        try { const u = new URL(l.source.url); if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com" || u.username || u.password || u.port) return null; } catch { return null; }
        source = { kind: "artwork", songId: l.source.songId, url: l.source.url };
      } else if (l.source.kind === "upload" && typeof l.source.objectPath === "string" && /^workspaces\/[a-f0-9-]{36}\/studio\/overlay-assets\/[a-f0-9-]{36}\.png$/.test(l.source.objectPath)) source = { kind: "upload", objectPath: l.source.objectPath };
      else return null;
    }
    ids.add(l.id);
    layers.push({ id: l.id, label: l.label, kind: l.kind as OverlayLayer["kind"], enabled: l.enabled, x: l.x, y: l.y, width: l.width, scale: l.scale, opacity: l.opacity, blur: l.blur, start: l.start, end: l.end, text: l.text, fontSize: l.fontSize, background: l.background, outline: l.outline, ...(source ? { source } : {}) });
  }
  const videoSets: NonNullable<OverlayComposition["videoSets"]> = [];
  if (value.videoSets !== undefined) {
    if (!Array.isArray(value.videoSets) || value.videoSets.length > 8) return null;
    const keys = new Set<string>();
    for (const set of value.videoSets) {
      if (!record(set) || typeof set.videoKey !== "string" || !/^(upload:[a-f0-9-]{36}|pixabay:[1-9][0-9]{0,11})$/.test(set.videoKey) || keys.has(set.videoKey)) return null;
      const validated = validateOverlayComposition({ schemaVersion: 2, layers: set.layers });
      if (!validated) return null;
      keys.add(set.videoKey); videoSets.push({ videoKey: set.videoKey, layers: validated.layers });
    }
  }
  return { schemaVersion: 2, layers, ...(videoSets.length ? { videoSets } : {}) };
}
export function validateOverlaySnapshot(value: unknown): OverlaySnapshot | null {
  if (!record(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) return null;
  const composition = validateOverlayComposition(value.composition);
  return composition ? { revision: value.revision as number, composition } : null;
}
export function overlayIdentity(value?: OverlaySnapshot | null) { return value ? JSON.stringify(validateOverlaySnapshot(value)) : "none"; }
export function defaultOverlayComposition(duration: number, artwork?: { id: string; url: string }): OverlayComposition {
  const base = { enabled: true, x: 50, y: 50, width: 64, scale: 1, opacity: 100, blur: 0, start: 0, end: duration, text: "", fontSize: 128, background: false, outline: false };
  return { schemaVersion: 2, layers: [
    { ...base, id: "cover", label: "Cover art", kind: "image", y: 55, width: 72, enabled: !!artwork, source: artwork ? { kind: "artwork", songId: artwork.id, url: artwork.url } : { kind: "platform-logos" } },
    { ...base, id: "platforms", label: "Platform logos", kind: "image", y: 88, width: 72, source: { kind: "platform-logos" } },
    { ...base, id: "text", label: "Text", kind: "text", y: 25, text: "OUT NOW", outline: true }
  ] };
}
export function migrateLegacyOverlays(value: unknown, duration: number, artworks: Array<{ id: string; url: string; legacyId?: string }>): OverlayComposition {
  const v = record(value) ? value : {};
  const artwork = artworks.find((a) => a.id === v.selectedArtworkId || a.legacyId === v.selectedArtworkId) ?? artworks[0];
  const composition = defaultOverlayComposition(duration, artwork);
  for (const l of composition.layers) {
    const transform = v[l.id === "cover" ? "coverTransform" : l.id === "text" ? "textTransform" : "platformTransform"];
    if (record(transform)) {
      if (finite(transform.x, 0, 100)) l.x = transform.x;
      if (finite(transform.y, 0, 100)) l.y = transform.y;
      if (l.id === "cover" && finite(transform.size, 1, 100)) { l.width = transform.size; l.y = Math.min(100, l.y + l.width * 9 / 16 / 2); }
      if (l.id !== "cover" && finite(transform.scale, .1, 3)) l.scale = transform.scale;
    }
    // Legacy controls applied only to the selected layer. Capture that visible state.
    if (l.id === v.selectedLayerId) { if (finite(v.opacity, 0, 100)) l.opacity = v.opacity; if (finite(v.blur, 0, 100)) l.blur = v.blur / 8; if (finite(v.scale, 0, 100)) l.scale = Math.min(3, l.scale * (.55 + v.scale / 110)); }
    if (l.id === "text") { if (typeof v.headline === "string") l.text = v.headline.slice(0, 280); if (finite(v.fontSize, 12, 96)) l.fontSize = v.fontSize * 2; if (typeof v.background === "boolean") l.background = v.background; if (typeof v.outline === "boolean") l.outline = v.outline; }
  }
  return composition;
}

/** Stable source identity keeps an overlay set linked when its trim changes. */
export function videoOverlayKey(video: { assetId?: string; videoAssetId?: string; pixabayVideoId?: string }) {
  return video.pixabayVideoId ? `pixabay:${video.pixabayVideoId}` : `upload:${video.assetId ?? video.videoAssetId}`;
}
export function compositionForVideo(composition: OverlayComposition, videoKey: string): OverlayComposition {
  return { schemaVersion: 2, layers: composition.videoSets?.find((set) => set.videoKey === videoKey)?.layers ?? composition.layers };
}
export function ensureVideoOverlaySets(composition: OverlayComposition, videoKeys: string[]): OverlayComposition {
  const missing = [...new Set(videoKeys)].filter((key) => !composition.videoSets?.some((set) => set.videoKey === key));
  if (!missing.length) return composition;
  return { ...composition, videoSets: [...(composition.videoSets ?? []), ...missing.map((videoKey) => ({ videoKey, layers: structuredClone(composition.layers) }))] };
}
export function updateVideoOverlayLayer(composition: OverlayComposition, videoKey: string, layer: OverlayLayer): OverlayComposition {
  const next = ensureVideoOverlaySets(composition, [videoKey]);
  return { ...next, videoSets: next.videoSets!.map((set) => set.videoKey === videoKey ? { ...set, layers: set.layers.map((item) => item.id === layer.id ? layer : item) } : set) };
}

/** Every enabled overlay spans the project length selected in Audio. */
export function fitOverlaysToDuration(composition: OverlayComposition, duration: number): OverlayComposition {
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) throw new RangeError("Invalid project duration.");
  const fit = (layers: OverlayLayer[]) => layers.every(layer => layer.start === 0 && layer.end === duration)
    ? layers : layers.map(layer => layer.start === 0 && layer.end === duration ? layer : { ...layer, start: 0, end: duration });
  const layers = fit(composition.layers);
  const videoSets = composition.videoSets?.map(set => {
    const fitted = fit(set.layers);
    return fitted === set.layers ? set : { ...set, layers: fitted };
  });
  if (layers === composition.layers && videoSets?.every((set, index) => set === composition.videoSets![index])) return composition;
  if (layers === composition.layers && !videoSets) return composition;
  return { ...composition, layers, ...(videoSets ? { videoSets } : {}) };
}

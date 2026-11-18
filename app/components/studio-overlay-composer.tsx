"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { exportVideoChoices, type BatchAudio, type BatchVideo } from "@/lib/studio/render-batch";
import type { PixabayVideoResult } from "@/lib/studio/pixabay";
import { compositionForVideo, ensureVideoOverlaySets, updateVideoOverlayLayer, videoOverlayKey, type OverlayLayer } from "@/lib/studio/overlays";
import { useOverlayRasters, useStudioOverlays } from "./studio-overlay-state";
import { StudioCompositionPlayer } from "./studio-composition-player";

export type StudioArtworkChoice = { id: string; title: string; url: string; legacyId?: string };
export function StudioOverlayComposer({ workspaceId, duration, artworks, audio, video, onContinue }: { workspaceId: string; duration: number; artworks: StudioArtworkChoice[]; audio?: BatchAudio; video?: BatchVideo; onContinue: () => void }) {
  const [savedVideos, setSavedVideos] = useState<BatchVideo[]>([]);
  const [selectedVideoKey, setSelectedVideoKey] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => { try {
      const [a, d] = await Promise.all([fetch("/api/studio/video-uploads", { signal: controller.signal }), fetch("/api/studio/selection-draft", { signal: controller.signal })]);
      if (!a.ok || !d.ok) return;
      const assets = await a.json() as { assets: Array<{ id: string; fileName: string }> };
      const draft = await d.json() as { uploadedVideoSnippets: Array<{ assetId: string; start: number; end: number }>; pixabayVideos: PixabayVideoResult[] };
      if (!controller.signal.aborted) setSavedVideos(exportVideoChoices(assets.assets, draft.uploadedVideoSnippets, draft.pixabayVideos ?? []));
    } catch { /* Source selection remains available in Video. */ } })();
    return () => controller.abort();
  }, [workspaceId]);
  const videoChoices = savedVideos.filter((item, index, all) => all.findIndex((candidate) => videoOverlayKey(candidate) === videoOverlayKey(item)) === index);
  const backgroundVideo = videoChoices.find((item) => videoOverlayKey(item) === selectedVideoKey) ?? videoChoices.find((item) => video && videoOverlayKey(item) === videoOverlayKey(video)) ?? videoChoices[0];
  const activeVideoKey = backgroundVideo ? videoOverlayKey(backgroundVideo) : "";
  const state = useStudioOverlays(workspaceId, duration, artworks);
  const videoKeys = JSON.stringify(videoChoices.map(videoOverlayKey));
  const { loaded, canEdit, setComposition } = state;
  useEffect(() => {
    if (loaded && canEdit) setComposition((current) => ensureVideoOverlaySets(current, JSON.parse(videoKeys) as string[]));
  }, [loaded, canEdit, setComposition, videoKeys]);
  const activeComposition = compositionForVideo(state.composition, activeVideoKey);
  const rasters = useOverlayRasters(activeComposition);
  const [selectedId, setSelectedId] = useState("text"), [uploading, setUploading] = useState(false), [notice, setNotice] = useState("");
  const selected = activeComposition.layers.find((l) => l.id === selectedId) ?? activeComposition.layers[0];
  function change(layer: OverlayLayer) { if (activeVideoKey) state.setComposition((c) => updateVideoOverlayLayer(c, activeVideoKey, layer)); }
  function update(patch: Partial<OverlayLayer>) { if (selected) change({ ...selected, ...patch }); }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !selected) return;
    const id = selected.id, targetVideoKey = activeVideoKey; setUploading(true); setNotice("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/studio/overlays/images", { method: "POST", body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The image could not upload.");
      state.setComposition((c) => {
        const current = compositionForVideo(c, targetVideoKey).layers.find((layer) => layer.id === id);
        return current ? updateVideoOverlayLayer(c, targetVideoKey, { ...current, source: result.source, enabled: true }) : c;
      });
    } catch (e) { setNotice(e instanceof Error ? e.message : "The image could not upload."); }
    finally { setUploading(false); event.target.value = ""; }
  }
  const time = (n: number) => `${n.toFixed(1)}s`;
  return <section className="studio-overlays" aria-label="Overlays"><div className="studio-overlays-grid">
    <section className="studio-overlays-controls"><div className="studio-panel-heading"><div><p className="eyebrow">Selected layer</p><h3>{selected?.kind === "text" ? `Text: ${selected.text}` : selected?.label}</h3></div><span className="studio-preview-status">{selected?.kind}</span></div>
      {selected ? <fieldset key={selected.id} disabled={!state.canEdit || !state.loaded || !activeVideoKey || uploading} className="studio-overlay-fields">
        <label><input type="checkbox" checked={selected.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Include in export</label>
        {selected.kind === "text" ? <><label className="studio-text-input">Text<input value={selected.text} maxLength={280} onChange={(e) => update({ text: e.target.value })} /></label><label className="studio-text-input">Font size<input type="number" min={12} max={320} value={selected.fontSize} onChange={(e) => update({ fontSize: Math.max(12, Math.min(320, Number(e.target.value))) })} /></label><div className="studio-text-toggles"><label><input type="checkbox" checked={selected.background} onChange={(e) => update({ background: e.target.checked })} /> Background</label><label><input type="checkbox" checked={selected.outline} onChange={(e) => update({ outline: e.target.checked })} /> Outline</label></div></> : <>
          {selected.id === "cover" ? <label className="studio-text-input">Production artwork<select value={selected.source?.kind === "artwork" ? selected.source.songId : ""} onChange={(e) => { const artwork = artworks.find((a) => a.id === e.target.value); if (artwork) update({ source: { kind: "artwork", songId: artwork.id, url: artwork.url }, enabled: true }); }}><option value="" disabled>Select artwork</option>{artworks.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label> : <div className="studio-overlay-asset-source"><strong>Platform logos image</strong><small>Spotify · Apple Music · YouTube · Amazon Music · Deezer</small></div>}
          <label className="studio-overlay-upload">{uploading ? "Uploading…" : "Choose image"}<input aria-label="Upload overlay image" accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(e) => void upload(e)} /></label><small>PNG, JPEG, WebP or GIF · up to 4 MB. GIF uses its first frame.</small>
          {selected.id === "platforms" ? <button type="button" className="studio-outline-button" onClick={() => update({ source: { kind: "platform-logos" }, enabled: true })}>Use default platform logos</button> : null}
        </>}
        <label className="studio-range-control"><span>Opacity</span><input aria-label="Layer opacity" type="range" min={0} max={100} value={selected.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} /><output>{selected.opacity}%</output></label>
        <label className="studio-range-control"><span>Scale</span><input aria-label="Layer scale" type="range" min={.1} max={3} step={.01} value={selected.scale} onChange={(e) => update({ scale: Number(e.target.value) })} /><output>{Math.round(selected.scale * 100)}%</output></label>
        <label className="studio-range-control"><span>Blur</span><input aria-label="Layer blur" type="range" min={0} max={30} step={.1} value={selected.blur} onChange={(e) => update({ blur: Number(e.target.value) })} /><output>{selected.blur.toFixed(1)}</output></label>
        <div className="studio-overlay-coordinates">{(["x", "y"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()} %<input aria-label={`Layer ${axis} position`} type="number" min={0} max={100} step={.1} value={Math.round(selected[axis] * 10) / 10} onChange={(e) => update({ [axis]: Math.max(0, Math.min(100, Number(e.target.value))) })} /></label>)}</div>
        <div className="studio-overlay-coordinates"><div>In point<strong>0.0s</strong></div><div>Out point<strong>{time(duration)}</strong></div></div><small>Follows the video length selected in Audio.</small>
      </fieldset> : null}
      <p role="status" className="studio-overlay-save-state">{state.error || notice || (!state.loaded ? "Loading shared overlays…" : !state.canEdit ? "View-only overlays" : state.saving ? "Saving overlays…" : "Saved · available on every device")}</p>{state.error ? <button type="button" onClick={state.retrySave}>Retry save</button> : null}
    </section>
    <section className="studio-overlays-preview"><div className="studio-panel-heading"><div><p className="eyebrow">Live composition</p><h3>Preview</h3></div><span>{duration}s</span></div><StudioCompositionPlayer key={activeVideoKey} audio={audio} video={backgroundVideo} duration={duration} composition={activeComposition} rasters={rasters.layers} selectedId={selectedId} onSelect={setSelectedId} onChange={state.canEdit ? change : undefined} /><p role="status">{rasters.error || (!rasters.ready ? "Updating overlay preview…" : "")}</p>{rasters.error ? <button type="button" onClick={rasters.retry}>Retry preview</button> : null}</section>
    <section className="studio-overlays-stack"><div className="studio-panel-heading"><div><p className="eyebrow">Selected for export</p><h3>Overlay sets</h3></div><span>{videoChoices.length} sets</span></div><p className="studio-overlay-stack-note">One independent set per video. Select a video, then choose a layer to edit.</p><div className="studio-overlay-video-sets">{videoChoices.map((item, index) => {
      const key = videoOverlayKey(item), isActive = key === activeVideoKey, set = compositionForVideo(state.composition, key);
      return <section className={`studio-overlay-video-set${isActive ? " is-active" : ""}`} key={key}>
        <button className="studio-overlay-set-heading" type="button" aria-expanded={isActive} disabled={uploading} onClick={() => setSelectedVideoKey(key)}>
          <span className="studio-stack-thumb" aria-hidden>▣</span><span><strong>Video {index + 1} · {item.pixabayVideoId ? "Pixabay" : "Shared upload"}</strong><small title={item.fileName}>{item.fileName}</small></span><span>{set.layers.filter((layer) => layer.enabled).length} layers</span>
        </button>
        {isActive ? <div className="studio-stack-list">{set.layers.slice().reverse().map((l) => <button type="button" aria-pressed={selectedId === l.id} className={`studio-stack-item studio-overlay-stack-item is-${l.id}`} key={l.id} onClick={() => setSelectedId(l.id)}><span className="studio-stack-thumb" aria-hidden>{l.kind === "text" ? "T" : "▧"}</span><span><strong>{l.kind === "text" ? `Text: ${l.text}` : l.label}</strong><small>{l.kind === "text" ? "Text" : "Image"} · {time(l.start)}–{time(l.end)}{!l.enabled ? " · hidden" : ""}</small></span></button>)}</div> : null}
      </section>;
    })}</div><button type="button" className="studio-primary-action" disabled={!state.saved || !rasters.ready || !videoChoices.length || uploading} onClick={onContinue}>Continue to export</button></section>
  </div><section className="studio-overlays-timeline"><div className="studio-timeline-heading"><p className="eyebrow">Composition timeline</p><span>0 / {duration}s</span></div><div className="studio-overlays-track"><span>Overlays</span><div className="studio-overlays-segments"><b>Text · Cover art · Platform logos<small>0–{duration}s · Combined composition</small></b>{Array.from({ length: 30 }, (_, index) => <i key={index} aria-hidden style={rasters.layers[0] ? { backgroundImage: `url(${rasters.layers[0].dataUrl})` } : undefined} />)}</div></div><div className="studio-video-track"><span>Video</span><div><i style={{ flexGrow: 1 }}>{backgroundVideo?.fileName ?? "Select a video"}<small>0–{duration}s · Video source</small></i></div></div><div className="studio-video-audio-track"><span>Audio</span><div className="studio-timeline-waveform"><b>{audio?.title ?? "Select audio"}</b>{Array.from({ length: 70 }, (_, index) => <i aria-hidden key={index} style={{ height: `${35 + index * 19 % 60}%` }} />)}</div></div></section></section>;
}

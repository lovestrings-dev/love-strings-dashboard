"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createRenderBatch, renderCombinations, exportVideoChoices, findRenderForPair, type BatchAudio, type BatchVideo, type RenderBatch } from "@/lib/studio/render-batch";
import type { PixabayVideoResult } from "@/lib/studio/pixabay";
import { AudioPlayer } from "./audio-player";
import { StudioCompositionPlayer } from "./studio-composition-player";
import { useStudioOverlays, useOverlayRasters } from "./studio-overlay-state";
import type { StudioArtworkChoice } from "./studio-overlay-composer";
import { compositionForVideo, videoOverlayKey, type OverlaySnapshot } from "@/lib/studio/overlays";
import { validateRenderRequest } from "@/lib/studio/render-request";

type Asset = { id: string; fileName: string; durationSeconds: number };
type Details = { overlaySetKey?: string; overlaySetLabel?: string; includeOverlays?: boolean; audioTitle: string; audioStart: number; audioEnd: number; videoName: string; videoStart: number; videoEnd: number; durationSeconds: number; songId?: string; videoAssetId?: string; pixabayVideoId?: string; overlaySnapshot?: OverlaySnapshot };
type RenderJob = { id: string; status: string; error: string | null; createdAt: string; previewUrl: string | null; details?: Details | null };
type Props = { artworks?: StudioArtworkChoice[]; audioSnippets: Array<BatchAudio & { artworkUrl?: string }>; durationSeconds: number; orientation: string; workspaceId: string };
const active = (job: RenderJob) => ["queued", "running"].includes(job.status);
const times = (start: number, end: number) => `${start.toFixed(1)}–${end.toFixed(1)}s`;

export function StudioExportMixer(props: Props) {
  return <Mixer key={props.workspaceId} {...props} />;
}

function Mixer({ artworks = [], audioSnippets, durationSeconds, orientation, workspaceId }: Props) {
  const overlays = useStudioOverlays(workspaceId, durationSeconds, artworks);
  const overlayPreview = useOverlayRasters(overlays.composition);
  const [selectedOverlayKeys, setSelectedOverlayKeys] = useState<string[] | null>(null);
  const [previewOverlayKeys, setPreviewOverlayKeys] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<BatchVideo[]>([]);
  const [audioIds, setAudioIds] = useState<string[] | null>(null);
  const [videoKeys, setVideoKeys] = useState<string[] | null>(null);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [batch, setBatch] = useState<RenderBatch | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `artistdeck:studio-render-batch:v1:${workspaceId}`;
  const selectedAudio = audioSnippets.filter((a) => (audioIds ?? audioSnippets.slice(0, 2).map((s) => s.id)).includes(a.id));
  const selectedVideos = videos.filter((v) => (videoKeys ?? videos.slice(0, 2).map((s) => s.key)).includes(v.key));
  const selectedOverlayVideos = (overlays.composition.videoSets ?? []).flatMap((set, index) => {
    const video = videos.find((item) => videoOverlayKey(item) === set.videoKey);
    return video ? [{ ...video, overlaySetKey: set.videoKey, overlaySetLabel: `Overlay set ${index + 1}` }] : [];
  });
  const includedOverlaySets = selectedOverlayVideos.filter((video) => (selectedOverlayKeys ?? selectedOverlayVideos.slice(0, 2).map((item) => item.overlaySetKey)).includes(video.overlaySetKey)).map((video) => ({ key: video.overlaySetKey, label: video.overlaySetLabel }));
  const includedOverlayCount = includedOverlaySets.length;
  const combinations = renderCombinations(selectedAudio, selectedVideos, includedOverlaySets);
  const busy = jobs.some(active);
  const pending = !!batch && batch.next < batch.pairs.length;
  const locked = busy || submitting || pending;
  const coversDuration = selectedAudio.length > 0 && selectedAudio.every((a) => a.end - a.start >= durationSeconds - 0.05);
  const canSubmit = overlays.saved && overlayPreview.ready && loaded && canGenerate && selectedVideos.length > 0 && coversDuration && orientation === "vertical" && !locked;
  const total = combinations.length;
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const displayedBatch = batch && (pending || busy) ? batch : null;
  const slots = displayedBatch ? displayedBatch.pairs.filter((p) => !deletedIds.includes(p.request.requestId)).map((p) => ({ id: p.request.requestId, job: jobMap.get(p.request.requestId), title: `${p.audioTitle} · ${times(p.request.audioStart, p.request.audioEnd)} × ${p.videoName} · ${times(p.request.videoStart, p.request.videoEnd)}${p.overlaySetLabel ? ` × ${p.overlaySetLabel}` : ""}` })) : combinations.map((combination) => {
    const { audio, video, includeOverlays, overlaySetKey, overlaySetLabel } = combination;
    const job = findRenderForPair(audio, video, durationSeconds, jobs, overlays.snapshot, includeOverlays, overlaySetKey);
    return { id: job?.id ?? combination.key, job, title: `${audio.title} · ${times(audio.start, audio.end)} × ${video.fileName} · ${times(video.start, video.end)} × ${overlaySetLabel}` };
  });
  const completedCount = slots.filter((slot) => slot.job?.status === "succeeded").length;
  const downloadIds = [...new Set(slots.flatMap((slot) => slot.job?.status === "succeeded" && slot.job.previewUrl ? [slot.job.id] : []))];
  const downloadAllUrl = `/api/studio/render-jobs/download?${new URLSearchParams(downloadIds.map((id) => ["id", id]))}`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [assetsResponse, draftResponse, jobsResponse] = await Promise.all([
          fetch("/api/studio/video-uploads", { signal: controller.signal }),
          fetch("/api/studio/selection-draft", { signal: controller.signal }),
          fetch("/api/studio/render-jobs", { signal: controller.signal })
        ]);
        if (!assetsResponse.ok || !draftResponse.ok || !jobsResponse.ok) throw new Error("Export sources or render history could not be loaded.");
        const assets = await assetsResponse.json() as { assets: Asset[] };
        const draft = await draftResponse.json() as { pixabayVideos?: PixabayVideoResult[]; uploadedVideoSnippets: Array<{ assetId: string; start: number; end: number }> };
        const history = await jobsResponse.json() as { jobs: RenderJob[]; canGenerate: boolean; canDelete: boolean };
        if (controller.signal.aborted) return;
        const choices = exportVideoChoices(assets.assets, draft.uploadedVideoSnippets, draft.pixabayVideos ?? []);
        setVideos(choices); setJobs(history.jobs); setCanGenerate(history.canGenerate); setCanDelete(history.canDelete);
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as RenderBatch | null;
          if (saved && Array.isArray(saved.pairs) && saved.pairs.length > 0 && saved.pairs.length <= 8 && Number.isInteger(saved.next) && saved.next >= 0 && saved.next <= saved.pairs.length && saved.pairs.every((p) => validateRenderRequest(p.request) && typeof p.audioTitle === "string" && typeof p.videoName === "string")) {
            setBatch(saved);
            if (saved.next < saved.pairs.length) setSelectedOverlayKeys([...new Set(saved.pairs.filter((pair) => pair.request.includeOverlays !== false).map((pair) => pair.request.overlaySetKey ?? videoOverlayKey(pair.request)))]);
          }
        } catch { /* A damaged or unavailable device cache does not block sources. */ }
        setLoaded(true);
      } catch (error) { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Export could not load."); }
    }
    void load();
    return () => controller.abort();
  }, [storageKey]);

  useEffect(() => {
    if (!loaded || !batch) return;
    try { localStorage.setItem(storageKey, JSON.stringify(batch)); }
    catch { /* The submission step pauses and reports a cache-write failure. */ }
  }, [batch, loaded, storageKey]);

  useEffect(() => {
    // Other devices can submit work while this Export screen is idle.
    if (!loaded) return;
    const controller = new AbortController();
    let checking = false;
    const interval = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/studio/render-jobs", { signal: controller.signal });
        if (!response.ok) throw new Error("Render status is temporarily unavailable. Refresh before generating again.");
        const payload = await response.json() as { jobs: RenderJob[]; canGenerate: boolean; canDelete: boolean };
        if (!controller.signal.aborted) { setJobs(payload.jobs); setCanGenerate(payload.canGenerate); setCanDelete(payload.canDelete); }
      } catch (error) { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Render status could not load."); }
      finally { checking = false; }
    }, 5000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [loaded]);

  // Each pair keeps its request ID across retries and reloads. Server-side
  // idempotency and the one-active-job index prevent duplicate executions.
  useEffect(() => {
    const tick = window.setTimeout(() => {
    if (!loaded || !batch || batch.paused || !pending || !canGenerate || busy || inFlight.current) return;
    const pair = batch.pairs[batch.next];
    const existing = jobs.find((j) => j.id === pair.request.requestId);
    if (existing || deletedIds.includes(pair.request.requestId)) {
      setBatch((b) => b ? { ...b, next: b.next + 1 } : b);
      return;
    }
    inFlight.current = true; setSubmitting(true);
    async function submit() {
      try {
        // Persist before the network call, so closing this page cannot lose the
        // idempotency key of a request that reached the server.
        localStorage.setItem(storageKey, JSON.stringify(batch));
        const response = await fetch("/api/studio/render-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pair.request, batchId: batch!.id, startBatch: batch!.next === 0 }) });
        const payload = await response.json() as { job?: RenderJob; error?: string };
        if (!response.ok || !payload.job) throw new Error(payload.error ?? "This pair could not start.");
        if (!mounted.current) return;
        const job = payload.job;
        setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
        setNotice("");
      } catch (error) {
        if (mounted.current) {
          setNotice(error instanceof Error ? error.message : "Batch paused. Check the current render before resuming.");
          setBatch((b) => b ? { ...b, paused: true } : b);
        }
      } finally { inFlight.current = false; if (mounted.current) setSubmitting(false); }
    }
    void submit();
    }, 0);
    return () => window.clearTimeout(tick);
  }, [batch, busy, canGenerate, deletedIds, jobs, loaded, pending, storageKey]);

  function generate() {
    if (!canSubmit) return;
    if (!window.confirm("Generate a new batch? Previous cloud outputs in this workspace will be permanently deleted. Download any results you want to keep first. Your source audio and videos stay available.")) return;
    try {
      const plan = createRenderBatch(selectedAudio, selectedVideos, durationSeconds, () => crypto.randomUUID(), overlays.snapshot ?? undefined, [], includedOverlaySets);
      localStorage.setItem(storageKey, JSON.stringify(plan));
      setBatch(plan); setNotice("Starting this batch removes previous cloud outputs from this workspace. Download any results you want to keep first."); setDeletedIds([]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The batch could not be prepared."); }
  }

  async function deleteResult() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/studio/render-jobs/${deleteId}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The result could not be deleted.");
      setJobs((current) => current.filter((j) => j.id !== deleteId));
      setDeletedIds((current) => [...current, deleteId]);
      setBatch((current) => {
        if (!current) return current;
        const index = current.pairs.findIndex((p) => p.request.requestId === deleteId);
        return index < 0 ? current : { ...current, pairs: current.pairs.filter((p) => p.request.requestId !== deleteId), next: Math.max(0, current.next - (index < current.next ? 1 : 0)) };
      });
      setDeleteId(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Deletion failed."); }
    finally { setDeleting(false); }
  }

  function toggle(value: string, current: string[], set: (v: string[]) => void) {
    if (locked) return;
    set(current.includes(value) ? current.filter((v) => v !== value) : current.length < 2 ? [...current, value] : current);
  }

  const status = loaded && !canGenerate ? "View-only" : submitting ? "Preparing next video" : busy ? "Rendering video" : batch?.paused ? "Batch paused" : pending ? "Waiting for next pair" : completedCount ? "Results ready" : "Ready to render";
  const help = !loaded ? "Loading your shared Studio sources…" : !selectedAudio.length ? "Select audio excerpts saved in Audio." : !selectedVideos.length ? "Select shared uploads or Pixabay videos in Video first." : !coversDuration ? `Each audio excerpt must cover ${durationSeconds} seconds.` : orientation !== "vertical" ? "Switch Video to vertical for 9:16 MP4." : !canGenerate ? "View-only access: you can preview and download results. Generation is limited to the proof-of-concept owner." : "";
  return <><header className="page-heading studio-heading studio-export-heading"><div><p className="eyebrow">Test Project · Export</p><h1 id="studio-heading">Export</h1></div><div className={`studio-mixer-status${locked ? " is-busy" : completedCount ? " is-ready" : ""}`} role="status"><i aria-hidden /><span>{status}{loaded ? ` · ${completedCount}/${displayedBatch?.pairs.length ?? total} ready` : ""}</span></div></header><section className="studio-export-mixer" aria-label="Export render controls">
    <div className="studio-mixer-grid studio-batch-layout"><div className="studio-mixer-controls">
      <div className="studio-mixer-section-heading"><div><p className="eyebrow">1 · Sources</p></div><span>{selectedAudio.length} audio × {selectedVideos.length} video × {includedOverlayCount} overlay sets</span></div>
      <details className="studio-source-category"><summary><strong>Audio</strong><span>{selectedAudio.length} selected <i aria-hidden>⌄</i></span></summary>
      <div className="studio-export-audio-sources" role="group" aria-label="Audio excerpts">{audioSnippets.map((a) => <article className="studio-export-audio-source" key={a.id}><input aria-label={`Include ${a.title} ${times(a.start, a.end)}`} type="checkbox" checked={selectedAudio.includes(a)} disabled={locked || (!selectedAudio.includes(a) && selectedAudio.length >= 2)} onChange={() => toggle(a.id, selectedAudio.map((s) => s.id), setAudioIds)} /><div className="studio-audio-snippet"><AudioPlayer artworkUrl={a.artworkUrl} clipStartSeconds={a.start} clipEndSeconds={a.end} fileName={`${a.title} · ${times(a.start, a.end)}`} src={a.sourceUrl} title={`${a.title} excerpt ${times(a.start, a.end)}`} /></div></article>)}</div>
      </details>
      <details className="studio-source-category"><summary><strong>Video</strong><span>{selectedVideos.length} selected <i aria-hidden>⌄</i></span></summary>
      <div className="studio-export-video-sources" role="group" aria-label="Selected videos">{videos.map((v) => <article className="studio-export-video-source" key={v.key}><video muted playsInline preload="metadata" poster={v.posterUrl} src={`${v.previewUrl ?? `/api/studio/video-uploads/${v.assetId}/preview`}#t=${v.start}`} aria-label={`${v.fileName} source thumbnail`} /><div className="studio-export-video-details"><label><input type="checkbox" checked={selectedVideos.includes(v)} disabled={locked || (!selectedVideos.includes(v) && selectedVideos.length >= 2)} onChange={() => toggle(v.key, selectedVideos.map((s) => s.key), setVideoKeys)} /><strong title={v.fileName}>{v.fileName}</strong></label><small>{times(v.start, v.end)} · {v.pixabayVideoId ? "Pixabay" : "Shared upload"}</small>{v.pixabayVideoId ? <small>by {v.creator} · <a href={v.pageUrl} target="_blank" rel="noreferrer">View on Pixabay</a></small> : null}</div></article>)}</div>
      </details>
      <details className="studio-source-category"><summary><strong>Overlays</strong><span>{includedOverlayCount} selected <i aria-hidden>⌄</i></span></summary>
      <div className="studio-export-overlay-sources" role="group" aria-label="Video overlay sets">{selectedOverlayVideos.map((video) => {
        const key = videoOverlayKey(video), layers = compositionForVideo(overlays.composition, key).layers.filter((layer) => layer.enabled);
        const rasters = overlayPreview.videoLayers[key] ?? overlayPreview.layers;
        const thumbnail = rasters.find((item) => item.id === "cover") ?? rasters[0];
        return <article className="studio-export-overlay-source" key={key} aria-label={`${video.overlaySetLabel} created for ${video.fileName}`}>
          <input type="checkbox" aria-label={`Include ${video.overlaySetLabel}`} checked={includedOverlaySets.some((set) => set.key === key)} disabled={locked || (!includedOverlaySets.some((set) => set.key === key) && includedOverlayCount >= 2)} onChange={() => { const keys = includedOverlaySets.map((set) => set.key); setSelectedOverlayKeys(keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]); }} /><span className="studio-export-overlay-thumb" aria-hidden>{thumbnail ? <Image src={thumbnail.dataUrl} alt="" width={42} height={42} unoptimized /> : "▧"}</span>
          <div><strong>{video.overlaySetLabel}</strong><small title={video.fileName}>{video.fileName}</small></div><span>{layers.length} layers</span>
        </article>;
      })}</div>
      </details>
      <section className="studio-generate-preview" aria-label="Preview before generation"><div className="studio-mixer-section-heading"><div><p className="eyebrow">2 · Generate</p></div></div><div className="studio-composition-preview-grid">{selectedVideos.map((video, index) => {
        const audio = selectedAudio[0];
        const previewSet = includedOverlaySets.find((set) => set.key === previewOverlayKeys[video.key]) ?? includedOverlaySets.find((set) => set.key === videoOverlayKey(video)) ?? includedOverlaySets[0];
        return <section className="studio-composition-preview-card" aria-label={`Composition preview: ${video.fileName}`} key={video.key}>
          <header><strong>Video {index + 1}</strong><small>{video.pixabayVideoId ? "Pixabay" : "Shared upload"}</small></header>{includedOverlaySets.length > 1 ? <select aria-label={`Preview overlay set for video ${index + 1}`} value={previewSet?.key ?? ""} onChange={(event) => setPreviewOverlayKeys((current) => ({ ...current, [video.key]: event.target.value }))}>{includedOverlaySets.map((set) => <option key={set.key} value={set.key}>{set.label}</option>)}</select> : null}
          <StudioCompositionPlayer key={`${video.key}:${audio?.id ?? "none"}`} audio={audio} video={video} duration={durationSeconds} composition={previewSet ? compositionForVideo(overlays.composition, previewSet.key) : { schemaVersion: 2, layers: [] }} rasters={previewSet ? overlayPreview.videoLayers[previewSet.key] ?? overlayPreview.layers : []} />
        </section>;
      })}</div>{!selectedVideos.length ? <p>Select videos in Video to preview their compositions.</p> : null}{overlays.error || overlayPreview.error || !overlays.saved || !overlayPreview.ready ? <p role="status">{overlays.error || overlayPreview.error || (!overlays.saved ? "Waiting for saved overlays…" : "Preparing overlay preview…")}</p> : null}</section>
      <div className="studio-mixer-submit"><div>{help ? <p>{help}</p> : null}{pending ? <p>Keep Export open to process the remaining pairs. Reopen it on this device to resume.</p> : null}</div><button className="studio-primary-action" type="button" disabled={!canSubmit} onClick={generate}>{locked ? status : `Generate ${total || ""} ${total === 1 ? "video" : "videos"}`}</button></div>
      {batch?.paused && pending ? <button type="button" disabled={busy || submitting || !canGenerate} onClick={() => { setBatch({ ...batch, paused: false }); setNotice(""); }}>Resume pending pairs</button> : null}
      {notice ? <p className="studio-mixer-notice" role="status">{notice}</p> : null}
    </div><div className="studio-mixer-result"><div className="studio-mixer-section-heading"><div><p className="eyebrow">Generated combinations</p><h3>Preview</h3></div><div className="studio-result-downloads"><span>{completedCount} ready</span><button type="button" disabled={!downloadIds.length} onClick={() => window.location.assign(downloadAllUrl)}>Download all videos</button></div></div><div className="studio-batch-previews">{slots.map((slot, index) => <article className="studio-batch-preview" key={slot.id} aria-label={`Video ${index + 1}: ${slot.title}`}><header><strong>Video {index + 1}</strong><span className={`studio-render-status is-${slot.job?.status ?? "queued"}`}>{slot.job?.status ?? "Waiting"}</span></header><div className="studio-batch-media">{slot.job?.previewUrl ? <video controls playsInline preload="metadata" src={`${slot.job.previewUrl}#t=0.01`} aria-label={`Generated video ${index + 1}: ${slot.title}`} /> : <div className="studio-batch-placeholder">{slot.job?.error ?? (active(slot.job ?? { status: "" } as RenderJob) ? "Rendering…" : "Waiting")}</div>}</div>{slot.job?.previewUrl ? <div className="studio-result-actions"><a href={slot.job.previewUrl}>Open</a><a href={`${slot.job.previewUrl}?download=1`}>Download MP4</a></div> : null}{slot.job && !active(slot.job) && canDelete ? <button className="studio-render-delete" type="button" onClick={() => setDeleteId(slot.id)}>Delete result</button> : null}</article>)}</div>{!slots.length ? <div className="studio-mixer-empty"><strong>Your generated videos will appear here</strong><small>Select audio excerpts, videos and overlay sets to build the render combinations.</small></div> : null}</div></div>
    {deleteId ? <div className="studio-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="studio-delete-title"><div><h3 id="studio-delete-title">Delete generated result?</h3><p>This permanently deletes the generated cloud video and removes it from Preview and history. Your audio and source videos stay available.</p><button type="button" disabled={deleting} onClick={() => void deleteResult()}>{deleting ? "Deleting…" : "Delete result"}</button><button type="button" disabled={deleting} autoFocus onClick={() => setDeleteId(null)}>Keep result</button></div></div> : null}
  </section></>;
}

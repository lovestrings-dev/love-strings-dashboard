"use client";

import { useEffect, useRef, useState } from "react";
import { createRenderBatch, findRenderForPair, type BatchAudio, type BatchVideo, type RenderBatch } from "@/lib/studio/render-batch";
import { validateRenderRequest } from "@/lib/studio/render-request";

type Asset = { id: string; fileName: string; durationSeconds: number };
type Details = { audioTitle: string; audioStart: number; audioEnd: number; videoName: string; videoStart: number; videoEnd: number; durationSeconds: number; songId?: string; videoAssetId?: string };
type RenderJob = { id: string; status: string; error: string | null; createdAt: string; previewUrl: string | null; details?: Details | null };
type Props = { audioSnippets: BatchAudio[]; durationSeconds: number; orientation: string; workspaceId: string };
const active = (job: RenderJob) => ["queued", "running"].includes(job.status);
const times = (start: number, end: number) => `${start.toFixed(1)}–${end.toFixed(1)}s`;

export function StudioExportMixer(props: Props) {
  return <Mixer key={props.workspaceId} {...props} />;
}

function Mixer({ audioSnippets, durationSeconds, orientation, workspaceId }: Props) {
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
  const busy = jobs.some(active);
  const pending = !!batch && batch.next < batch.pairs.length;
  const locked = busy || submitting || pending;
  const coversDuration = selectedAudio.length > 0 && selectedAudio.every((a) => a.end - a.start >= durationSeconds - 0.05);
  const canSubmit = loaded && canGenerate && selectedVideos.length > 0 && coversDuration && orientation === "vertical" && !locked;
  const total = selectedAudio.length * selectedVideos.length;
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const slots = batch ? batch.pairs.filter((p) => !deletedIds.includes(p.request.requestId)).map((p) => ({ id: p.request.requestId, job: jobMap.get(p.request.requestId), title: `${p.audioTitle} · ${times(p.request.audioStart, p.request.audioEnd)} × ${p.videoName} · ${times(p.request.videoStart, p.request.videoEnd)}` })) : selectedAudio.flatMap((a) => selectedVideos.map((v) => {
    const job = findRenderForPair(a, v, durationSeconds, jobs);
    return { id: job?.id ?? `${a.id}:${v.key}`, job, title: `${a.title} · ${times(a.start, a.end)} × ${v.fileName} · ${times(v.start, v.end)}` };
  }));
  const completedCount = slots.filter((slot) => slot.job?.status === "succeeded").length;

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
        const draft = await draftResponse.json() as { uploadedVideoSnippets: Array<{ assetId: string; start: number; end: number }> };
        const history = await jobsResponse.json() as { jobs: RenderJob[]; canGenerate: boolean; canDelete: boolean };
        if (controller.signal.aborted) return;
        const choices = assets.assets.flatMap((asset) => draft.uploadedVideoSnippets.filter((s) => s.assetId === asset.id).map((s) => ({ key: `${asset.id}:${s.start}:${s.end}`, assetId: asset.id, fileName: asset.fileName, start: s.start, end: s.end })));
        setVideos(choices); setJobs(history.jobs); setCanGenerate(history.canGenerate); setCanDelete(history.canDelete);
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as RenderBatch | null;
          if (saved && Array.isArray(saved.pairs) && saved.pairs.length > 0 && saved.pairs.length <= 4 && Number.isInteger(saved.next) && saved.next >= 0 && saved.next <= saved.pairs.length && saved.pairs.every((p) => validateRenderRequest(p.request) && typeof p.audioTitle === "string" && typeof p.videoName === "string")) {
            setBatch(saved);
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
      const plan = createRenderBatch(selectedAudio, selectedVideos, durationSeconds, () => crypto.randomUUID());
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
  const help = !loaded ? "Loading your shared Studio sources…" : !selectedAudio.length ? "Select audio excerpts saved in Audio." : !selectedVideos.length ? "Select shared snippets in Video first." : !coversDuration ? `Each audio excerpt must cover ${durationSeconds} seconds.` : orientation !== "vertical" ? "Switch Video to vertical for 9:16 MP4." : !canGenerate ? "View-only access: you can preview and download results. Generation is limited to the proof-of-concept owner." : "One video per audio × video pair. Short footage repeats to fill the output.";
  return <section className="studio-export-mixer" aria-labelledby="studio-mixer-heading">
    <header className="studio-mixer-header"><div><p className="eyebrow">Studio export · render queue</p><h2 id="studio-mixer-heading">Review and generate</h2><p>Combine your audio excerpts and shared video snippets.</p></div><div className={`studio-mixer-status${locked ? " is-busy" : completedCount ? " is-ready" : ""}`} role="status"><i aria-hidden /><span>{status}{batch ? ` · ${completedCount}/${batch.pairs.length} ready` : ""}</span></div></header>
    <div className="studio-mixer-specs" aria-label="Output specification"><span><small>Format</small><strong>9:16</strong></span><span><small>Resolution</small><strong>1080 × 1920</strong></span><span><small>Duration</small><strong>{durationSeconds}s</strong></span><span><small>Delivery</small><strong>MP4</strong></span></div>
    <div className="studio-mixer-grid studio-batch-layout"><div className="studio-mixer-controls">
      <div className="studio-mixer-section-heading"><div><p className="eyebrow">1 · Sources</p><h3>Choose the combinations</h3></div><span>{selectedAudio.length} audio × {selectedVideos.length} video</span></div>
      <h4>Audio excerpts · {selectedAudio.length} selected</h4><div className="studio-batch-sources">{audioSnippets.map((a) => <article className="studio-batch-source" key={a.id}><label><input type="checkbox" checked={selectedAudio.includes(a)} disabled={locked || (!selectedAudio.includes(a) && selectedAudio.length >= 2)} onChange={() => toggle(a.id, selectedAudio.map((s) => s.id), setAudioIds)} /><span>{a.title}<small>{times(a.start, a.end)}</small></span></label><audio controls preload="none" src={`${a.sourceUrl}#t=${a.start},${a.end}`} aria-label={`${a.title} audio excerpt ${times(a.start, a.end)}`} /></article>)}</div>
      <h4>Shared videos · {selectedVideos.length} selected</h4><div className="studio-batch-sources">{videos.map((v) => <article className="studio-batch-source" key={v.key}><video muted playsInline preload="metadata" src={`/api/studio/video-uploads/${v.assetId}/preview#t=${v.start}`} aria-label={`${v.fileName} source thumbnail`} /><label><input type="checkbox" checked={selectedVideos.includes(v)} disabled={locked || (!selectedVideos.includes(v) && selectedVideos.length >= 2)} onChange={() => toggle(v.key, selectedVideos.map((s) => s.key), setVideoKeys)} /><span>{v.fileName}<small>{times(v.start, v.end)}</small></span></label></article>)}</div>
      <div className="studio-mixer-submit"><div><p className="eyebrow">2 · Generate</p><p>{help}</p>{pending ? <p>Keep Export open to process the remaining pairs. Reopen it on this device to resume.</p> : null}</div><button className="studio-primary-action" type="button" disabled={!canSubmit} onClick={generate}>{locked ? status : `Generate ${total || ""} ${total === 1 ? "video" : "videos"}`}</button></div>
      {batch?.paused && pending ? <button type="button" disabled={busy || submitting || !canGenerate} onClick={() => { setBatch({ ...batch, paused: false }); setNotice(""); }}>Resume pending pairs</button> : null}
      {notice ? <p className="studio-mixer-notice" role="status">{notice}</p> : null}
    </div><div className="studio-mixer-result"><div className="studio-mixer-section-heading"><div><p className="eyebrow">Generated combinations</p><h3>Preview</h3></div><span>{completedCount} ready</span></div><div className="studio-batch-previews">{slots.map((slot, index) => <article className="studio-batch-preview" key={slot.id}><header><strong>Video {index + 1}</strong><span className={`studio-render-status is-${slot.job?.status ?? "queued"}`}>{slot.job?.status ?? "Waiting"}</span></header><p>{slot.title}</p>{slot.job?.previewUrl ? <><video controls playsInline preload="metadata" src={`${slot.job.previewUrl}#t=0.01`} aria-label={`Generated video ${index + 1}: ${slot.title}`} /><div className="studio-result-actions"><a href={slot.job.previewUrl}>Open</a><a href={`${slot.job.previewUrl}?download=1`}>Download MP4</a></div></> : <div className="studio-batch-placeholder">{slot.job?.error ?? (active(slot.job ?? { status: "" } as RenderJob) ? "Rendering this pair…" : "Waiting for this pair")}</div>}{slot.job && !active(slot.job) && canDelete ? <button className="studio-render-delete" type="button" onClick={() => setDeleteId(slot.id)}>Delete result</button> : null}</article>)}</div>{!slots.length ? <div className="studio-mixer-empty"><strong>Your generated videos will appear here</strong><small>Select up to two audio excerpts and two videos to create four combinations.</small></div> : null}</div></div>
    <section className="studio-render-history" aria-label="Render history"><div className="studio-mixer-section-heading"><div><p className="eyebrow">Queue activity</p><h3>Render history</h3></div><span>{jobs.length} renders</span></div>{jobs.length ? <ul>{jobs.map((job) => <li key={job.id}><div><strong className={`studio-render-status is-${job.status}`}>{job.status}</strong><span>{job.details ? `${job.details.audioTitle} ${times(job.details.audioStart, job.details.audioEnd)} × ${job.details.videoName}` : new Date(job.createdAt).toLocaleString()}</span></div>{job.error ? <p>{job.error}</p> : null}<div>{job.previewUrl ? <a href={`${job.previewUrl}?download=1`}>Download MP4</a> : null}{!active(job) && canDelete ? <button className="studio-render-delete" type="button" aria-label={`Delete render ${job.id}`} onClick={() => setDeleteId(job.id)}>Delete</button> : null}</div></li>)}</ul> : <div className="studio-history-empty">No generated results yet.</div>}</section>
    {deleteId ? <div className="studio-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="studio-delete-title"><div><h3 id="studio-delete-title">Delete generated result?</h3><p>This permanently deletes the generated cloud video and removes it from Preview and history. Your audio and source videos stay available.</p><button type="button" disabled={deleting} onClick={() => void deleteResult()}>{deleting ? "Deleting…" : "Delete result"}</button><button type="button" disabled={deleting} autoFocus onClick={() => setDeleteId(null)}>Keep result</button></div></div> : null}
  </section>;
}

"use client";

import { useEffect, useRef, useState } from "react";

type AudioSnippet = { id: string; songId: string; sourceUrl: string; title: string; start: number; end: number };
type Asset = { id: string; fileName: string; durationSeconds: number };
type VideoChoice = { key: string; assetId: string; fileName: string; start: number; end: number };
type RenderJob = { id: string; status: string; error: string | null; createdAt: string; previewUrl: string | null };

export function StudioExportMixer({ audioSnippets, durationSeconds, orientation, workspaceId }: { audioSnippets: AudioSnippet[]; durationSeconds: number; orientation: string; workspaceId: string }) {
  const [videos, setVideos] = useState<VideoChoice[]>([]);
  const [audioId, setAudioId] = useState("");
  const [videoKey, setVideoKey] = useState("");
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [canGenerate, setCanGenerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const pendingRequest = useRef<{ key: string; id: string } | null>(null);
  const audio = audioSnippets.find((item) => item.id === audioId) ?? audioSnippets[0];
  const video = videos.find((item) => item.key === videoKey) ?? videos[0];
  const busy = jobs.some((job) => job.status === "running" || job.status === "queued");
  const coversDuration = !!audio && audio.end - audio.start >= durationSeconds - 0.05;
  const completed = jobs.find((job) => job.status === "succeeded" && job.previewUrl);
  const audioDuration = audio ? Math.max(0, audio.end - audio.start) : 0;
  const videoDuration = video ? Math.max(0, video.end - video.start) : 0;
  const canSubmit = loaded && canGenerate && !!video && coversDuration && orientation === "vertical" && !submitting && !busy;
  const generationLabel = submitting ? "Preparing export" : busy ? "Rendering video" : completed ? "Latest render ready" : "Ready to render";
  const statusMessage = !audio ? "Save an audio excerpt in Audio first." : !coversDuration ? `Select at least ${durationSeconds} seconds of audio, or shorten the project in Audio.` : !loaded ? "Loading your shared Studio sources…" : !videos.length ? "Add a shared video in Video before rendering." : orientation !== "vertical" ? "Switch Video to vertical; the first renderer exports 9:16 MP4." : !canGenerate ? "Rendering is not enabled for this workspace or role yet." : "Your selected video will loop cleanly if it is shorter than the output.";

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
        const history = await jobsResponse.json() as { jobs: RenderJob[]; canGenerate: boolean };
        if (controller.signal.aborted) return;
        const choices = assets.assets.flatMap((asset) => {
          const trims = draft.uploadedVideoSnippets.filter((snippet) => snippet.assetId === asset.id);
          return (trims.length ? trims : [{ start: 0, end: asset.durationSeconds }]).map((trim) => ({ key: `${asset.id}:${trim.start}:${trim.end}`, assetId: asset.id, fileName: asset.fileName, start: trim.start, end: trim.end }));
        });
        setVideos(choices); setJobs(history.jobs); setCanGenerate(history.canGenerate); setLoaded(true);
      } catch (error) { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Export could not load."); }
    }
    void load();
    return () => controller.abort();
  }, [workspaceId]);

  useEffect(() => {
    if (!busy) return;
    const controller = new AbortController();
    let checking = false;
    const interval = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/studio/render-jobs", { signal: controller.signal });
        if (!response.ok) throw new Error("Render status is temporarily unavailable. Refresh before generating again.");
        const payload = await response.json() as { jobs: RenderJob[] };
        if (!controller.signal.aborted) { setJobs(payload.jobs); setNotice(""); }
      } catch (error) { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Render status could not load."); }
      finally { checking = false; }
    }, 5000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [busy, workspaceId]);

  async function generate() {
    if (!audio || !video || inFlight.current || busy || !canGenerate) return;
    const body = { songId: audio.songId, audioSourceUrl: audio.sourceUrl, audioStart: audio.start, audioEnd: audio.end, videoAssetId: video.assetId, videoStart: video.start, videoEnd: video.end, durationSeconds };
    const key = JSON.stringify(body);
    if (pendingRequest.current?.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() };
    inFlight.current = true; setSubmitting(true); setNotice("Preparing your video…");
    try {
      const response = await fetch("/api/studio/render-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId: pendingRequest.current.id }) });
      const payload = await response.json() as { job?: RenderJob; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error ?? "Generation could not start.");
      const job = payload.job;
      pendingRequest.current = null;
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Generation could not start. Refresh its status before trying again."); }
    finally { inFlight.current = false; setSubmitting(false); }
  }

  return <section className="studio-export-mixer" aria-labelledby="studio-mixer-heading">
    <header className="studio-mixer-header"><div><p className="eyebrow">Studio export · render queue</p><h2 id="studio-mixer-heading">Review and generate</h2><p>Build one focused 9:16 cut from a saved audio excerpt and shared footage.</p></div><div className={`studio-mixer-status${busy ? " is-busy" : completed ? " is-ready" : ""}`}><i aria-hidden /> <span>{generationLabel}</span></div></header>
    <div className="studio-mixer-specs" aria-label="Output specification"><span><small>Format</small><strong>9:16</strong></span><span><small>Resolution</small><strong>1080 × 1920</strong></span><span><small>Duration</small><strong>{durationSeconds}s</strong></span><span><small>Delivery</small><strong>MP4</strong></span></div>
    <div className="studio-mixer-grid"><div className="studio-mixer-controls">
      <div className="studio-mixer-section-heading"><div><p className="eyebrow">1 · Sources</p><h3>Choose the cut</h3></div><span>{audio && video ? "2 selected" : "Incomplete"}</span></div>
      <label>Audio excerpt<select value={audio?.id ?? ""} onChange={(event) => setAudioId(event.target.value)} disabled={submitting || busy}><option value="" disabled>Choose audio</option>{audioSnippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.title} · {snippet.start.toFixed(1)}–{snippet.end.toFixed(1)} s</option>)}</select></label>
      <div className={`studio-source-summary${audio && coversDuration ? " is-ready" : ""}`}><span aria-hidden>♫</span><div><strong>{audio?.title ?? "No audio excerpt"}</strong><small>{audio ? `${audioDuration.toFixed(1)}s selected${coversDuration ? " · covers output" : " · too short"}` : "Choose from saved Audio excerpts"}</small></div><b>{audio && coversDuration ? "Ready" : "Required"}</b></div>
      <label>Shared video<select value={video?.key ?? ""} onChange={(event) => setVideoKey(event.target.value)} disabled={submitting || busy}><option value="" disabled>Choose shared footage</option>{videos.map((item) => <option key={item.key} value={item.key}>{item.fileName} · {item.start.toFixed(1)}–{item.end.toFixed(1)} s</option>)}</select></label>
      <div className={`studio-source-summary${video ? " is-ready" : ""}`}><span aria-hidden>▣</span><div><strong>{video?.fileName ?? "No shared video"}</strong><small>{video ? `${videoDuration.toFixed(1)}s selected · repeats as needed` : "Upload and save footage in Video"}</small></div><b>{video ? "Ready" : "Required"}</b></div>
      <div className="studio-mixer-submit"><div><p className="eyebrow">2 · Generate</p><p>{statusMessage}</p></div><button className="studio-primary-action" type="button" disabled={!canSubmit} onClick={() => void generate()}>{submitting ? "Preparing…" : busy ? "Rendering…" : "Generate video"}</button></div>
      {notice ? <p className="studio-mixer-notice" role="status">{notice}</p> : null}
    </div><div className="studio-mixer-result"><div className="studio-mixer-section-heading"><div><p className="eyebrow">Latest export</p><h3>Preview</h3></div>{completed ? <span className="studio-result-ready">Ready</span> : null}</div>{completed?.previewUrl ? <><video key={completed.id} controls playsInline preload="metadata" src={completed.previewUrl} /><div className="studio-result-actions"><a href={completed.previewUrl}>Open preview</a><a className="studio-primary-action" href={`${completed.previewUrl}?download=1`}>Download MP4</a></div></> : <div className="studio-mixer-empty"><span aria-hidden>▶</span><strong>{busy ? "Your video is rendering" : "Your export preview will appear here"}</strong><small>{busy ? "This page checks the render queue automatically." : "When sources are ready, generate one reviewable MP4 cut."}</small></div>}</div></div>
    <section className="studio-render-history" aria-label="Render history"><div className="studio-mixer-section-heading"><div><p className="eyebrow">Queue activity</p><h3>Render history</h3></div><span>{jobs.length} {jobs.length === 1 ? "render" : "renders"}</span></div>{jobs.length ? <ul>{jobs.map((job) => <li key={job.id}><div><strong className={`studio-render-status is-${job.status}`}>{job.status}</strong><span>{new Date(job.createdAt).toLocaleString()}</span></div>{job.error ? <p>{job.error}</p> : null}{job.previewUrl ? <a href={`${job.previewUrl}?download=1`}>Download MP4</a> : null}</li>)}</ul> : <div className="studio-history-empty">No renders yet. Your completed exports will stay here for review and download.</div>}</section>
  </section>;
}

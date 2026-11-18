"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Play, Pause } from "lucide-react";
import type { BatchAudio, BatchVideo } from "@/lib/studio/render-batch";
import type { OverlayComposition, OverlayLayer, OverlayRaster } from "@/lib/studio/overlays";

export function StudioCompositionPlayer({ audio, video, duration, composition, rasters, selectedId, onSelect, onChange }: { audio?: BatchAudio; video?: BatchVideo; duration: number; composition: OverlayComposition; rasters: OverlayRaster[]; selectedId?: string; onSelect?: (id: string) => void; onChange?: (layer: OverlayLayer) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null), videoRef = useRef<HTMLVideoElement>(null), phoneRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false), [position, setPosition] = useState(0), [error, setError] = useState("");
  const drag = useRef<{ mode: string; clientX: number; clientY: number; layer: OverlayLayer } | null>(null);
  const videoUrl = video ? video.previewUrl ?? `/api/studio/video-uploads/${video.assetId}/preview` : "";
  function seek(t: number) {
    setPosition(t);
    if (audioRef.current && audio) audioRef.current.currentTime = audio.start + t;
    if (videoRef.current && video) videoRef.current.currentTime = video.start + (t % Math.max(.01, video.end - video.start));
  }
  useEffect(() => {
    if (!playing) return;
    let frame: number;
    const tick = () => {
      const a = audioRef.current, v = videoRef.current;
      const t = audio && a ? a.currentTime - audio.start : position;
      if (t >= duration) { a?.pause(); v?.pause(); setPlaying(false); setPosition(duration); return; }
      setPosition(Math.max(0, t));
      if (video && v) {
        const clipEnd = Number.isFinite(v.duration) ? Math.min(v.duration, video.end) : video.end;
        const target = video.start + (Math.max(0, t) % Math.max(.01, clipEnd - video.start));
        if (Math.abs(v.currentTime - target) > .3 || v.currentTime >= video.end) v.currentTime = target;
        if (v.paused) void v.play().catch(() => {});
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [audio, duration, playing, position, video]);
  async function toggle() {
    if (playing) { audioRef.current?.pause(); videoRef.current?.pause(); setPlaying(false); return; }
    if (position >= duration) seek(0); else seek(position);
    try { await Promise.all([audioRef.current?.play(), videoRef.current?.play()]); setPlaying(true); setError(""); } catch { setError("This source could not play. Select another source or retry playback."); }
  }
  function startDrag(event: PointerEvent, layer: OverlayLayer, mode: string) {
    if (!onChange) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(layer.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, clientX: event.clientX, clientY: event.clientY, layer };
  }
  function move(event: PointerEvent) {
    const d = drag.current, bounds = phoneRef.current?.getBoundingClientRect();
    if (!d || !bounds || !onChange) return;
    const dx = (event.clientX - d.clientX) / bounds.width * 100, dy = (event.clientY - d.clientY) / bounds.height * 100;
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    onChange(d.mode === "move" ? { ...d.layer, x: clamp(d.layer.x + dx, 0, 100), y: clamp(d.layer.y + dy, 0, 100) } : { ...d.layer, scale: clamp(d.layer.scale + Math.max(dx, dy) / 30, .1, 3) });
  }
  return <div className="studio-composition-player">
    <div className="studio-composition-phone" ref={phoneRef} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {videoUrl ? <video aria-label="Composition video source" muted playsInline preload="metadata" poster={video?.posterUrl} ref={videoRef} src={videoUrl} onLoadedMetadata={() => { if (videoRef.current && video) videoRef.current.currentTime = video.start; }} onError={() => setError("The selected video preview is unavailable.")} /> : <span className="studio-composition-no-video">Select a video in Video</span>}
      {composition.layers.map((layer, index) => {
        const image = rasters.find((r) => r.id === layer.id); if (!image || !layer.enabled) return null;
        const visible = position >= layer.start && position <= Math.min(duration, layer.end);
        return <div key={layer.id} className={`studio-composition-layer${selectedId === layer.id ? " is-selected" : ""}`} style={{ left: `${layer.x}%`, top: `${layer.y}%`, width: `${image.width / 1080 * 100}%`, aspectRatio: `${image.width}/${image.height}`, zIndex: index + 1, visibility: visible ? "visible" : "hidden" }} onPointerDown={(event) => startDrag(event, layer, "move")}>
          {/* Server-produced pixels are shared with FFmpeg. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt={layer.kind === "text" ? layer.text : layer.label} draggable={false} />
          {onChange && selectedId === layer.id ? <button type="button" aria-label={`Resize ${layer.label}`} className="studio-composition-resize" onPointerDown={(event) => startDrag(event, layer, "resize")} /> : null}
        </div>;
      })}
    </div>
    {audio ? <audio ref={audioRef} src={audio.sourceUrl} preload="metadata" onLoadedMetadata={() => { if (audioRef.current) audioRef.current.currentTime = audio.start; }} onError={() => setError("The selected audio preview is unavailable.")} /> : null}
    <div className="studio-composition-transport"><button type="button" aria-label={playing ? "Pause composition preview" : "Play composition with audio"} disabled={!audio || !video} onClick={() => void toggle()}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><input aria-label="Composition preview position" type="range" min={0} max={duration} step={.05} value={position} onChange={(e) => seek(Number(e.target.value))} /><span>{position.toFixed(1)} / {duration}s</span></div>
    {error ? <p role="status">{error}</p> : null}
  </div>;
}

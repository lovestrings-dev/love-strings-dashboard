"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

const waveformHeights = [24, 58, 83, 43, 69, 36, 74, 52, 88, 47, 31, 63, 77, 42, 55, 29, 70, 45, 82, 39, 64, 50, 90, 35, 58, 73, 44, 66, 28, 79, 53, 86, 38, 61, 46, 75, 33, 68, 51, 84, 40, 59, 30, 72, 48, 80, 36, 65, 43, 76, 55, 88, 32, 60, 45, 70, 38, 82, 50, 67];

type MediaTrimmerProps = {
  artworkAlt?: string;
  artworkUrl?: string;
  className?: string;
  isTrimEditable?: boolean;
  initialTrimRange?: { end: number; start: number };
  maxExcerptSeconds?: number;
  mediaType?: "audio" | "video";
  onPlaybackChange?: (isPlaying: boolean) => void;
  onTrimChange?: (range: { end: number; start: number }) => void;
  onTrimSelectionCommit?: (range: { end: number; start: number }) => void;
  playbackPosition?: number;
  playButtonPlacement?: "values" | "waveform";
  showPlayButton?: boolean;
  src: string;
  title: string;
};

export type MediaTrimmerHandle = { togglePlayback: () => void };

export const MediaTrimmer = forwardRef<MediaTrimmerHandle, MediaTrimmerProps>(function MediaTrimmer({ artworkAlt, artworkUrl, className = "", initialTrimRange, isTrimEditable = true, maxExcerptSeconds, mediaType = "audio", onPlaybackChange, onTrimChange, onTrimSelectionCommit, playbackPosition, playButtonPlacement = "values", showPlayButton = true, src, title }, ref) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const selectionDragRef = useRef<{ clientX: number; hasMoved: boolean; start: number } | null>(null);
  const isVideoTrim = mediaType === "video";
  const [mediaDuration, setMediaDuration] = useState(30);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const excerptLimit = Math.min(mediaDuration, Math.max(0.1, maxExcerptSeconds ?? mediaDuration));
  const isLockedToProject = (isVideoTrim || !isTrimEditable) && typeof maxExcerptSeconds === "number";
  const usesFixedSelectionWindow = isLockedToProject;
  const trimLength = Math.max(0, trimEnd - trimStart);
  const visibleDuration = usesFixedSelectionWindow
    ? Math.min(mediaDuration, Math.max(trimLength * 3, trimLength + 2))
    : Math.min(mediaDuration, Math.max(trimLength + 2, mediaDuration / zoom));
  const selectionCenter = (trimStart + trimEnd) / 2;
  const viewStart = usesFixedSelectionWindow
    ? Math.min(
      Math.max(-trimLength, selectionCenter - visibleDuration / 2),
      Math.max(-trimLength, mediaDuration - trimLength * 2)
    )
    : Math.min(Math.max(0, selectionCenter - visibleDuration / 2), Math.max(0, mediaDuration - visibleDuration));
  const viewEnd = viewStart + visibleDuration;
  const visiblePlayhead = playbackPosition === undefined ? playhead : playbackPosition;
  const toVisiblePercent = (time: number) => ((time - viewStart) / visibleDuration) * 100;
  const selectionStyle = {
    "--media-trim-end": `${toVisiblePercent(trimEnd)}%`,
    "--media-trim-playhead": `${toVisiblePercent(visiblePlayhead)}%`,
    "--media-trim-start": `${toVisiblePercent(trimStart)}%`
  } as CSSProperties;
  const waveformStyle = {
    left: `${toVisiblePercent(0)}%`,
    transform: "none",
    width: `${(mediaDuration / visibleDuration) * 100}%`
  } as CSSProperties;

  function syncDuration(duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    setMediaDuration(duration);
    const initialStart = Math.min(Math.max(0, initialTrimRange?.start ?? 0), Math.max(0, duration - 0.1));
    const defaultEnd = isLockedToProject ? initialStart + (maxExcerptSeconds ?? duration) : Math.min(15, duration, maxExcerptSeconds ?? duration);
    const requestedEnd = initialTrimRange?.end ?? defaultEnd;
    const initialEnd = Math.max(Math.min(duration, initialStart + 0.1), Math.min(duration, initialStart + excerptLimit, requestedEnd));
    setTrimStart(initialStart);
    setTrimEnd(initialEnd);
    setPlayhead(initialStart);
    onTrimChange?.({ end: initialEnd, start: initialStart });
  }

  function togglePlayback() {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      if (media.currentTime < trimStart || media.currentTime >= trimEnd) media.currentTime = trimStart;
      void media.play().catch(() => { setIsPlaying(false); onPlaybackChange?.(false); });
    } else media.pause();
  }

  useImperativeHandle(ref, () => ({ togglePlayback }));

  function updatePlayhead(nextTime: number) {
    const media = mediaRef.current;
    if (!media) return;
    const clampedTime = Math.min(trimEnd, Math.max(trimStart, nextTime));
    media.currentTime = clampedTime;
    setPlayhead(clampedTime);
  }

  function updateStart(nextStart: number) {
    const safeStart = Math.min(Math.max(0, nextStart), Math.max(0, trimEnd - 0.1));
    setTrimStart(safeStart);
    const nextEnd = Math.min(trimEnd, safeStart + excerptLimit);
    setTrimEnd(nextEnd);
    onTrimChange?.({ end: nextEnd, start: safeStart });
    if (playhead < safeStart) updatePlayhead(safeStart);
  }

  function updateEnd(nextEnd: number) {
    const safeEnd = Math.max(Math.min(Math.min(mediaDuration, trimStart + excerptLimit), nextEnd), Math.min(mediaDuration, trimStart + 0.1));
    setTrimEnd(safeEnd);
    onTrimChange?.({ end: safeEnd, start: trimStart });
    if (playhead > safeEnd) updatePlayhead(safeEnd);
  }

  function beginSelectionMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isLockedToProject) return;
    selectionDragRef.current = { clientX: event.clientX, hasMoved: false, start: trimStart };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveSelection(event: React.PointerEvent<HTMLDivElement>) {
    const dragStart = selectionDragRef.current;
    if (!dragStart || !isLockedToProject) return;
    if (Math.abs(event.clientX - dragStart.clientX) > 1) dragStart.hasMoved = true;
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextStart = Math.min(
      Math.max(0, dragStart.start + ((event.clientX - dragStart.clientX) / bounds.width) * visibleDuration),
      Math.max(0, mediaDuration - trimLength)
    );
    const nextEnd = nextStart + trimLength;
    setTrimStart(nextStart);
    setTrimEnd(nextEnd);
    onTrimChange?.({ end: nextEnd, start: nextStart });
    if (isVideoTrim) {
      updatePlayhead(nextStart);
      const media = mediaRef.current;
      if (media?.paused) void media.play().catch(() => { setIsPlaying(false); onPlaybackChange?.(false); });
    } else if (playhead < nextStart || playhead > nextEnd) updatePlayhead(nextStart);
  }

  function endSelectionMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragStart = selectionDragRef.current;
    if (dragStart?.hasMoved && event.type === "pointerup") {
      const bounds = event.currentTarget.getBoundingClientRect();
      const start = Math.min(
        Math.max(0, dragStart.start + ((event.clientX - dragStart.clientX) / bounds.width) * visibleDuration),
        Math.max(0, mediaDuration - trimLength)
      );
      onTrimSelectionCommit?.({ end: start + trimLength, start });
    }
    selectionDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const mediaProps = {
    onDurationChange: (event: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => syncDuration(event.currentTarget.duration),
    onEnded: () => { setIsPlaying(false); onPlaybackChange?.(false); setPlayhead(trimStart); },
    onPause: () => { setIsPlaying(false); onPlaybackChange?.(false); },
    onPlay: () => { setIsPlaying(true); onPlaybackChange?.(true); },
    onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
      const nextTime = event.currentTarget.currentTime;
      if (nextTime >= trimEnd) {
        event.currentTarget.pause();
        event.currentTarget.currentTime = trimStart;
        setPlayhead(trimStart);
      } else setPlayhead(nextTime);
    },
    preload: "metadata" as const,
    src
  };

  return (
    <div className={`media-trimmer${isVideoTrim ? " is-video-trimmer" : ""}${usesFixedSelectionWindow ? " has-fixed-selection-window" : ""} ${className}`} style={selectionStyle}>
      {mediaType === "video" ? <video {...mediaProps} ref={(element) => { mediaRef.current = element; }} /> : <audio {...mediaProps} ref={(element) => { mediaRef.current = element; }} />}
      <div className={`media-trimmer-values${showPlayButton && playButtonPlacement === "values" ? "" : " is-without-play"}`}><label>In <output>{formatMediaTime(trimStart)}</output></label><label>Out <output>{formatMediaTime(trimEnd)}</output></label>{showPlayButton && playButtonPlacement === "values" ? <button aria-label={isPlaying ? `Pause trimmed ${title}` : `Play trimmed ${title}`} className="media-trimmer-play" onClick={togglePlayback} type="button">{isPlaying ? <Pause aria-hidden size={17} /> : <Play aria-hidden size={17} />}</button> : null}</div>
      <div className="media-trimmer-waveform">
        {showPlayButton && playButtonPlacement === "waveform" ? <button aria-label={isPlaying ? `Pause trimmed ${title}` : `Play trimmed ${title}`} className="media-trimmer-waveform-play" onClick={togglePlayback} type="button">{artworkUrl ? <Image alt={artworkAlt ?? `${title} album art`} height={58} src={artworkUrl} unoptimized width={58} /> : <span aria-hidden>{title.slice(0, 1).toUpperCase()}</span>}<span aria-hidden className="media-trimmer-waveform-play-overlay">{isPlaying ? <Pause size={18} /> : <Play size={18} />}</span></button> : null}
        <div className={`media-trimmer-waveform-track${isLockedToProject ? " is-selection-movable" : ""}`} onPointerCancel={endSelectionMove} onPointerDown={beginSelectionMove} onPointerMove={moveSelection} onPointerUp={endSelectionMove}>
          <div aria-hidden className="media-trimmer-waveform-bars" style={waveformStyle}>{waveformHeights.map((height, index) => <i aria-hidden key={index} style={{ height: `${height}%` }} />)}</div>
          <div aria-hidden className="media-trimmer-selection" />
          {!usesFixedSelectionWindow || !isVideoTrim ? <span aria-hidden className="media-trimmer-playhead" /> : null}
          {!isLockedToProject ? <input aria-label={`Playback position for ${title}`} max={viewEnd} min={viewStart} onChange={(event) => updatePlayhead(Number(event.target.value))} step="0.05" type="range" value={Math.min(viewEnd, Math.max(viewStart, playhead))} /> : null}
        </div>
      </div>
      {!usesFixedSelectionWindow ? <label className="media-trimmer-zoom"><span>Zoom</span><input aria-label={`Zoom trim editor for ${title}`} max="6" min="1" onChange={(event) => setZoom(Number(event.target.value))} step="1" type="range" value={zoom} /><output>{zoom}×</output></label> : null}
      {isTrimEditable && !isVideoTrim ? <div className="media-trimmer-range"><label>Start<input aria-label={`Trim start for ${title}`} max={Math.max(0, trimEnd - 0.1)} min="0" onChange={(event) => updateStart(Number(event.target.value))} step="0.05" type="range" value={trimStart} /></label><label>End<input aria-label={`Trim end for ${title}`} max={Math.min(mediaDuration, trimStart + excerptLimit)} min={Math.min(mediaDuration, trimStart + 0.1)} onChange={(event) => updateEnd(Number(event.target.value))} step="0.05" type="range" value={trimEnd} /></label></div> : null}
    </div>
  );
});

function formatMediaTime(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${String(Math.floor(safeValue / 60)).padStart(2, "0")}:${String(safeValue % 60).padStart(2, "0")}`;
}

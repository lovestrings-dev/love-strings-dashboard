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
  maxExcerptSeconds?: number;
  mediaType?: "audio" | "video";
  onPlaybackChange?: (isPlaying: boolean) => void;
  onTrimChange?: (range: { end: number; start: number }) => void;
  playButtonPlacement?: "values" | "waveform";
  showPlayButton?: boolean;
  src: string;
  title: string;
};

export type MediaTrimmerHandle = { togglePlayback: () => void };

export const MediaTrimmer = forwardRef<MediaTrimmerHandle, MediaTrimmerProps>(function MediaTrimmer({ artworkAlt, artworkUrl, className = "", isTrimEditable = true, maxExcerptSeconds, mediaType = "audio", onPlaybackChange, onTrimChange, playButtonPlacement = "values", showPlayButton = true, src, title }, ref) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const selectionDragRef = useRef<{ clientX: number; start: number } | null>(null);
  const [mediaDuration, setMediaDuration] = useState(30);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const excerptLimit = Math.min(mediaDuration, Math.max(0.1, maxExcerptSeconds ?? mediaDuration));
  const isLockedToProject = !isTrimEditable && typeof maxExcerptSeconds === "number";
  const trimLength = Math.max(0, trimEnd - trimStart);
  const selectionStyle = {
    "--media-trim-end": `${(trimEnd / mediaDuration) * 100}%`,
    "--media-trim-playhead": `${(playhead / mediaDuration) * 100}%`,
    "--media-trim-start": `${(trimStart / mediaDuration) * 100}%`
  } as CSSProperties;

  function syncDuration(duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    setMediaDuration(duration);
    const initialEnd = isLockedToProject ? Math.min(duration, maxExcerptSeconds ?? duration) : Math.min(15, duration, maxExcerptSeconds ?? duration);
    setTrimEnd(initialEnd);
    setPlayhead(0);
    onTrimChange?.({ end: initialEnd, start: 0 });
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
    selectionDragRef.current = { clientX: event.clientX, start: trimStart };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveSelection(event: React.PointerEvent<HTMLDivElement>) {
    const dragStart = selectionDragRef.current;
    if (!dragStart || !isLockedToProject) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextStart = Math.min(
      Math.max(0, dragStart.start + ((event.clientX - dragStart.clientX) / bounds.width) * mediaDuration),
      Math.max(0, mediaDuration - trimLength)
    );
    const nextEnd = nextStart + trimLength;
    setTrimStart(nextStart);
    setTrimEnd(nextEnd);
    onTrimChange?.({ end: nextEnd, start: nextStart });
    if (playhead < nextStart || playhead > nextEnd) updatePlayhead(nextStart);
  }

  function endSelectionMove(event: React.PointerEvent<HTMLDivElement>) {
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
    <div className={`media-trimmer ${className}`} style={selectionStyle}>
      {mediaType === "video" ? <video {...mediaProps} ref={(element) => { mediaRef.current = element; }} /> : <audio {...mediaProps} ref={(element) => { mediaRef.current = element; }} />}
      <div className={`media-trimmer-values${showPlayButton && playButtonPlacement === "values" ? "" : " is-without-play"}`}><label>In <output>{formatMediaTime(trimStart)}</output></label><label>Out <output>{formatMediaTime(trimEnd)}</output></label>{showPlayButton && playButtonPlacement === "values" ? <button aria-label={isPlaying ? `Pause trimmed ${title}` : `Play trimmed ${title}`} className="media-trimmer-play" onClick={togglePlayback} type="button">{isPlaying ? <Pause aria-hidden size={17} /> : <Play aria-hidden size={17} />}</button> : null}</div>
      <div className="media-trimmer-waveform">
        {showPlayButton && playButtonPlacement === "waveform" ? <button aria-label={isPlaying ? `Pause trimmed ${title}` : `Play trimmed ${title}`} className="media-trimmer-waveform-play" onClick={togglePlayback} type="button">{artworkUrl ? <Image alt={artworkAlt ?? `${title} album art`} height={58} src={artworkUrl} unoptimized width={58} /> : <span aria-hidden>{title.slice(0, 1).toUpperCase()}</span>}<span aria-hidden className="media-trimmer-waveform-play-overlay">{isPlaying ? <Pause size={18} /> : <Play size={18} />}</span></button> : null}
        <div className={`media-trimmer-waveform-track${isLockedToProject ? " is-selection-movable" : ""}`} onPointerCancel={endSelectionMove} onPointerDown={beginSelectionMove} onPointerMove={moveSelection} onPointerUp={endSelectionMove}>
          <div aria-hidden className="media-trimmer-selection" />
          {waveformHeights.map((height, index) => <i aria-hidden key={index} style={{ height: `${height}%` }} />)}
          <span aria-hidden className="media-trimmer-playhead" />
          <input aria-label={`Playback position for ${title}`} max={mediaDuration} min="0" onChange={(event) => updatePlayhead(Number(event.target.value))} step="0.05" type="range" value={playhead} />
        </div>
      </div>
      {isTrimEditable ? <div className="media-trimmer-range"><label>Start<input aria-label={`Trim start for ${title}`} max={Math.max(0, trimEnd - 0.1)} min="0" onChange={(event) => updateStart(Number(event.target.value))} step="0.05" type="range" value={trimStart} /></label><label>End<input aria-label={`Trim end for ${title}`} max={Math.min(mediaDuration, trimStart + excerptLimit)} min={Math.min(mediaDuration, trimStart + 0.1)} onChange={(event) => updateEnd(Number(event.target.value))} step="0.05" type="range" value={trimEnd} /></label></div> : null}
    </div>
  );
});

function formatMediaTime(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${String(Math.floor(safeValue / 60)).padStart(2, "0")}:${String(safeValue % 60).padStart(2, "0")}`;
}

"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// A deliberate decorative waveform. Generating an amplitude-accurate waveform
// belongs to the future Studio audio-analysis/rendering pipeline.
const waveformHeights = [32, 47, 28, 61, 78, 43, 69, 36, 53, 84, 46, 30, 67, 42, 57, 35, 73, 48, 64, 39, 55, 31, 71, 45, 59, 37, 66, 50, 76, 42, 58, 33, 63, 47, 72, 38];

type AudioPlayerProps = {
  artworkAlt?: string;
  artworkUrl?: string;
  clipEndSeconds?: number;
  clipStartSeconds?: number;
  className?: string;
  fileName?: string;
  onPlaybackPositionChange?: (position: number) => void;
  src: string;
  title: string;
};

export type AudioPlayerHandle = { playExcerpt: (range: { end: number; start: number }) => void };

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer({ artworkAlt, artworkUrl, className = "", clipEndSeconds, clipStartSeconds = 0, fileName, onPlaybackPositionChange, src, title }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeExcerptRef = useRef<{ end: number; start: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const start = Math.max(0, clipStartSeconds);
  const end = clipEndSeconds === undefined ? duration : Math.min(duration || clipEndSeconds, Math.max(start, clipEndSeconds));
  const playableDuration = Math.max(0, end - start);
  const progress = playableDuration > 0 ? Math.min(100, Math.max(0, ((position - start) / playableDuration) * 100)) : 0;
  const playerStyle = { "--audio-player-progress": `${progress}%` } as CSSProperties;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    activeExcerptRef.current = null;
    setDuration(0);
    setIsPlaying(false);
    setPosition(start);
  }, [src, start]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    if (audio.currentTime < start || (end > start && audio.currentTime > end)) audio.currentTime = start;
    setPosition(start);
  }, [end, start]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      activeExcerptRef.current = null;
      if (audio.currentTime < start || (end > start && audio.currentTime >= end)) audio.currentTime = start;
      void audio.play().catch(() => setIsPlaying(false));
    }
    else audio.pause();
  }

  function seek(nextPosition: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextPosition;
    setPosition(nextPosition);
  }

  useImperativeHandle(ref, () => ({
    playExcerpt(range) {
      const audio = audioRef.current;
      if (!audio) return;
      const excerptStart = Math.max(start, range.start);
      const excerptEnd = Math.max(excerptStart, range.end);
      activeExcerptRef.current = { end: excerptEnd, start: excerptStart };
      audio.currentTime = excerptStart;
      setPosition(excerptStart);
      onPlaybackPositionChange?.(excerptStart);
      void audio.play().catch(() => setIsPlaying(false));
    }
  }), [onPlaybackPositionChange, start]);

  return (
    <div className={`audio-player ${className}`} style={playerStyle}>
      <audio
        onDurationChange={(event) => {
          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
          setDuration(nextDuration);
          if (start > 0) { event.currentTarget.currentTime = start; setPosition(start); }
        }}
        onEnded={() => { activeExcerptRef.current = null; setIsPlaying(false); setPosition(start); onPlaybackPositionChange?.(start); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => {
          const nextPosition = event.currentTarget.currentTime;
          const activeExcerpt = activeExcerptRef.current;
          const playbackEnd = activeExcerpt?.end ?? end;
          if (playbackEnd > start && nextPosition >= playbackEnd) {
            event.currentTarget.pause();
            const restartPosition = activeExcerpt?.start ?? start;
            event.currentTarget.currentTime = restartPosition;
            setPosition(restartPosition);
            onPlaybackPositionChange?.(restartPosition);
            activeExcerptRef.current = null;
            return;
          }
          setPosition(nextPosition);
          onPlaybackPositionChange?.(nextPosition);
        }}
        preload="metadata"
        ref={audioRef}
        src={src}
      />
      <button aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`} className="audio-player-artwork" onClick={togglePlayback} type="button">
        {artworkUrl ? <Image alt={artworkAlt ?? `${title} album art`} height={42} src={artworkUrl} unoptimized width={42} /> : <span aria-hidden>{title.slice(0, 1).toUpperCase()}</span>}
        <span aria-hidden className="audio-player-artwork-control">{isPlaying ? <Pause size={15} /> : <Play size={15} />}</span>
      </button>
      <div className="audio-player-track-details">
        <strong title={fileName ?? title}>{fileName ?? title}</strong>
        <div className="audio-player-waveform">
          <div aria-hidden className="audio-player-waveform-bars">
            {waveformHeights.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
          </div>
          <span aria-hidden className="audio-player-playhead" />
          <input aria-label={`Audio progress for ${title}`} max={end || 0} min={start} onChange={(event) => seek(Number(event.target.value))} step="0.1" type="range" value={Math.min(Math.max(position, start), end || start)} />
        </div>
      </div>
      <span className="audio-player-duration">{formatAudioTime(playableDuration || (clipEndSeconds === undefined ? duration : Math.max(0, clipEndSeconds - start)))}</span>
    </div>
  );
});

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const totalSeconds = Math.floor(value);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

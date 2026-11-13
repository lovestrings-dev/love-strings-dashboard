"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// A deliberate decorative waveform. Generating an amplitude-accurate waveform
// belongs to the future Studio audio-analysis/rendering pipeline.
const waveformHeights = [32, 47, 28, 61, 78, 43, 69, 36, 53, 84, 46, 30, 67, 42, 57, 35, 73, 48, 64, 39, 55, 31, 71, 45, 59, 37, 66, 50, 76, 42, 58, 33, 63, 47, 72, 38];

type AudioPlayerProps = {
  artworkAlt?: string;
  artworkUrl?: string;
  className?: string;
  fileName?: string;
  src: string;
  title: string;
};

export function AudioPlayer({ artworkAlt, artworkUrl, className = "", fileName, src, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const playerStyle = { "--audio-player-progress": `${progress}%` } as CSSProperties;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setDuration(0);
    setIsPlaying(false);
    setPosition(0);
  }, [src]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }

  function seek(nextPosition: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextPosition;
    setPosition(nextPosition);
  }

  return (
    <div className={`audio-player ${className}`} style={playerStyle}>
      <audio
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => { setIsPlaying(false); setPosition(0); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
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
          <input aria-label={`Audio progress for ${title}`} max={duration || 0} min="0" onChange={(event) => seek(Number(event.target.value))} step="0.1" type="range" value={Math.min(position, duration || 0)} />
        </div>
      </div>
      <span className="audio-player-duration">{formatAudioTime(duration)}</span>
    </div>
  );
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const totalSeconds = Math.floor(value);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

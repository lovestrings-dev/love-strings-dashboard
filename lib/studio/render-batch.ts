import type { StudioRenderRequest } from "./render-request";

export type BatchAudio = { id: string; songId: string; sourceUrl: string; title: string; start: number; end: number };
export type BatchVideo = { key: string; assetId: string; fileName: string; start: number; end: number };
export type BatchPair = { request: StudioRenderRequest; audioTitle: string; videoName: string };
export type RenderBatch = { id: string; pairs: BatchPair[]; next: number; paused: boolean };

type PairDetails = { audioTitle: string; audioStart: number; audioEnd: number; videoName: string; videoStart: number; videoEnd: number; durationSeconds: number; songId?: string; videoAssetId?: string };
export function findRenderForPair<T extends { details?: PairDetails | null }>(audio: BatchAudio, video: BatchVideo, duration: number, jobs: T[]): T | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
  return jobs.find(({ details: d }) => d &&
    (d.songId ? d.songId === audio.songId : d.audioTitle === audio.title) &&
    (d.videoAssetId ? d.videoAssetId === video.assetId : d.videoName === video.fileName) &&
    near(d.audioStart, audio.start) && near(d.audioEnd, audio.end) &&
    near(d.videoStart, video.start) && near(d.videoEnd, video.end) && d.durationSeconds === duration);
}

export function createRenderBatch(audio: BatchAudio[], videos: BatchVideo[], durationSeconds: number, uuid: () => string): RenderBatch {
  if (!audio.length || audio.length > 2 || !videos.length || videos.length > 2) throw new Error("Choose up to two audio excerpts and two video clips.");
  if (audio.some((a) => a.end - a.start < durationSeconds - 0.05)) throw new Error("Each audio excerpt must cover the output duration.");
  return { id: uuid(), next: 0, paused: false, pairs: audio.flatMap((a) => videos.map((v) => ({ audioTitle: a.title, videoName: v.fileName, request: { requestId: uuid(), songId: a.songId, audioSourceUrl: a.sourceUrl, audioStart: a.start, audioEnd: a.end, videoAssetId: v.assetId, videoStart: v.start, videoEnd: v.end, durationSeconds } }))) };
}

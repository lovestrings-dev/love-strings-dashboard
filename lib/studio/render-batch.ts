import type { StudioRenderRequest } from "./render-request";
import type { PixabayVideoResult } from "./pixabay";
import { videoOverlayKey, overlayIdentity, type OverlaySnapshot } from "./overlays.ts";

export type BatchAudio = { id: string; songId: string; sourceUrl: string; title: string; start: number; end: number };
export type BatchVideo = { key: string; fileName: string; start: number; end: number; previewUrl?: string; posterUrl?: string; pageUrl?: string; creator?: string } & ({ assetId: string; pixabayVideoId?: never } | { assetId?: never; pixabayVideoId: string });
export type BatchOverlaySet = { key: string; label: string };
export type BatchPair = { request: StudioRenderRequest; audioTitle: string; videoName: string; overlaySetLabel?: string };
export type RenderBatch = { id: string; pairs: BatchPair[]; next: number; paused: boolean };

export function exportVideoChoices(assets: Array<{ id: string; fileName: string }>, uploaded: Array<{ assetId: string; start: number; end: number }>, pixabay: PixabayVideoResult[]): BatchVideo[] {
  return [
    ...assets.flatMap((asset) => uploaded.filter((s) => s.assetId === asset.id).map((s) => ({ key: `${asset.id}:${s.start}:${s.end}`, assetId: asset.id, fileName: asset.fileName, start: s.start, end: s.end }))),
    ...pixabay.filter((clip) => /^[1-9][0-9]{0,11}$/.test(clip.id) && Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0 && clip.durationSeconds <= 1800).map((clip) => ({ key: `pixabay:${clip.id}`, pixabayVideoId: clip.id, fileName: clip.tags, start: 0, end: clip.durationSeconds, previewUrl: clip.previewVideoUrl, posterUrl: clip.previewUrl, pageUrl: clip.pageUrl, creator: clip.creator }))
  ];
}

type PairDetails = { overlaySetKey?: string; includeOverlays?: boolean; audioTitle: string; audioStart: number; audioEnd: number; videoName: string; videoStart: number; videoEnd: number; durationSeconds: number; songId?: string; videoAssetId?: string; pixabayVideoId?: string; overlaySnapshot?: OverlaySnapshot };
export function findRenderForPair<T extends { details?: PairDetails | null }>(audio: BatchAudio, video: BatchVideo, duration: number, jobs: T[], overlaySnapshot?: OverlaySnapshot | null, includeOverlays = true, overlaySetKey?: string): T | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
  return jobs.find(({ details: d }) => d && (d.includeOverlays !== false) === includeOverlays &&
    (d.overlaySetKey ?? (includeOverlays ? videoOverlayKey(video) : undefined)) === (overlaySetKey ?? (includeOverlays ? videoOverlayKey(video) : undefined)) &&
    overlayIdentity(d.overlaySnapshot) === overlayIdentity(overlaySnapshot) &&
    (d.songId ? d.songId === audio.songId : d.audioTitle === audio.title) &&
    (video.pixabayVideoId ? d.pixabayVideoId === video.pixabayVideoId : !d.pixabayVideoId && (d.videoAssetId ? d.videoAssetId === video.assetId : d.videoName === video.fileName)) &&
    near(d.audioStart, audio.start) && near(d.audioEnd, audio.end) &&
    near(d.videoStart, video.start) && near(d.videoEnd, video.end) && d.durationSeconds === duration);
}

export type RenderCombination = { key: string; audio: BatchAudio; video: BatchVideo; overlaySetKey?: string; overlaySetLabel?: string; includeOverlays: boolean };
/** One shared plan drives counts, waiting slots and actual queue requests. */
export function renderCombinations(audio: BatchAudio[], videos: BatchVideo[], overlaySets?: readonly BatchOverlaySet[]): RenderCombination[] {
  if (overlaySets && (overlaySets.length > 2 || new Set(overlaySets.map(set => set.key)).size !== overlaySets.length)) throw new Error("Choose up to two different overlay sets.");
  const variants: Array<BatchOverlaySet | undefined> = overlaySets?.length ? [...overlaySets] : [undefined];
  return audio.flatMap(a => videos.flatMap(video => variants.map(set => ({ key: JSON.stringify([a.id, video.key, set?.key ?? (overlaySets ? "none" : "linked")]), audio: a, video, includeOverlays: overlaySets === undefined || !!set, ...(set ? { overlaySetKey: set.key, overlaySetLabel: set.label } : overlaySets ? { overlaySetLabel: "No overlays" } : {}) }))));
}
export function createRenderBatch(audio: BatchAudio[], videos: BatchVideo[], durationSeconds: number, uuid: () => string, overlaySnapshot?: OverlaySnapshot, excludedOverlayVideoKeys: readonly string[] = [], overlaySets?: readonly BatchOverlaySet[]): RenderBatch {
  if (!audio.length || audio.length > 2 || !videos.length || videos.length > 2) throw new Error("Choose up to two audio excerpts and two video clips.");
  if (audio.some((a) => a.end - a.start < durationSeconds - 0.05)) throw new Error("Each audio excerpt must cover the output duration.");
  if (overlaySets?.some(set => !overlaySnapshot?.composition.videoSets?.some(saved => saved.videoKey === set.key))) throw new Error("Save the selected overlay sets in Overlays before generating.");
  return { id: uuid(), next: 0, paused: false, pairs: renderCombinations(audio, videos, overlaySets).map(({ audio: a, video: v, includeOverlays, overlaySetKey, overlaySetLabel }) => ({ audioTitle: a.title, videoName: v.fileName, ...(overlaySetLabel ? { overlaySetLabel } : {}), request: { requestId: uuid(), ...(!includeOverlays || (overlaySets === undefined && excludedOverlayVideoKeys.includes(videoOverlayKey(v))) ? { includeOverlays: false } : {}), ...(overlaySetKey ? { overlaySetKey } : {}), songId: a.songId, audioSourceUrl: a.sourceUrl, audioStart: a.start, audioEnd: a.end, ...(v.pixabayVideoId ? { pixabayVideoId: v.pixabayVideoId } : { videoAssetId: v.assetId }), videoStart: v.start, videoEnd: v.end, durationSeconds, ...(overlaySnapshot ? { overlaySnapshot: structuredClone(overlaySnapshot) } : {}) } })) };
}

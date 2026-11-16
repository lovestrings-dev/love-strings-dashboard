// Frames remain in component memory. Never persist private signed URLs or media
// frames in a public image service/browser storage to render these thumbnails.
export function captureStudioVideoFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
  try {
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    // Undecodable video, unavailable canvas or a CORS-blocked frame must not
    // interrupt upload/selection or leave an unhandled event exception.
    return null;
  }
}

export function captureStudioVideoFrameFromUrl(url: string, signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const finish = (frame: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(frame);
    };
    const abort = () => finish(null);
    const timeout = setTimeout(abort, 20000);
    signal?.addEventListener("abort", abort, { once: true });
    // Set before src: the authenticated same-origin preview redirects to GCS.
    // Anonymous CORS keeps the decoded frame readable by canvas after redirect.
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      // Move beyond the initial blank frame without requiring autoplay on iOS.
      if (Number.isFinite(video.duration) && video.duration > 0.1) video.currentTime = Math.min(0.1, video.duration / 2);
      else finish(captureStudioVideoFrame(video));
    };
    video.onseeked = () => finish(captureStudioVideoFrame(video));
    video.onerror = abort;
    video.src = url;
    video.load();
  });
}

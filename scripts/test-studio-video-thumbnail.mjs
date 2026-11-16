import assert from "node:assert/strict";
import { captureStudioVideoFrame, captureStudioVideoFrameFromUrl } from "../lib/studio/video-thumbnail.ts";
import { studioVideoUploadMimeType } from "../lib/studio/video-upload-type.ts";

const originalDocument = globalThis.document;
let canvas;
let video;
let mode = "success";
class FakeVideo {
  videoWidth = 2160;
  videoHeight = 3840;
  readyState = 4;
  duration = 2.733;
  paused = false;
  set src(value) {
    assert.equal(this.crossOrigin, "anonymous", "CORS must be set before the redirecting media source");
    assert.equal(this.playsInline, true);
    this.source = value;
  }
  set currentTime(value) { this.seekTime = value; queueMicrotask(() => this.onseeked?.()); }
  load() {
    if (!this.source || mode === "pending") return;
    queueMicrotask(() => mode === "error" ? this.onerror?.() : this.onloadeddata?.());
  }
  pause() { this.paused = true; }
  removeAttribute(name) { assert.equal(name, "src"); this.source = undefined; }
}
globalThis.document = {
  createElement(tag) {
    if (tag === "video") return video = new FakeVideo();
    assert.equal(tag, "canvas");
    return canvas = {
      getContext() { return { drawImage() { if (mode === "tainted") throw new Error("SecurityError"); } }; },
      toDataURL() { return "data:image/jpeg;base64,test-frame"; }
    };
  }
};
try {
  assert.equal(await captureStudioVideoFrameFromUrl("/api/studio/video-uploads/test/preview"), "data:image/jpeg;base64,test-frame");
  assert.equal(canvas.width, 270);
  assert.equal(canvas.height, 480);
  assert.equal(video.seekTime, 0.1);
  assert.equal(video.source, undefined);
  assert.equal(video.paused, true);
  assert.equal(video.onloadeddata, null);
  mode = "error";
  assert.equal(await captureStudioVideoFrameFromUrl("/missing"), null);
  mode = "tainted";
  assert.equal(await captureStudioVideoFrameFromUrl("/blocked-cors"), null);
  mode = "pending";
  const controller = new AbortController();
  const pending = captureStudioVideoFrameFromUrl("/slow", controller.signal);
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(video.source, undefined);
  assert.equal(await captureStudioVideoFrameFromUrl("/not-started", controller.signal), null);
  assert.equal(captureStudioVideoFrame({ videoWidth: 2160, videoHeight: 3840, readyState: 0 }), null);
  assert.equal(studioVideoUploadMimeType({ name: "IMG_2929.MOV", type: "application/octet-stream" }), "video/quicktime");
  assert.equal(studioVideoUploadMimeType({ name: "IMG_2929.MOV", type: "" }), "video/quicktime");
  assert.equal(studioVideoUploadMimeType({ name: "clip.mp4", type: "" }), "video/mp4");
  assert.equal(studioVideoUploadMimeType({ name: "clip.mov", type: "video/mp4" }), "video/mp4");
  console.log("Studio video frame capture, cleanup and picker MIME regressions passed.");
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}

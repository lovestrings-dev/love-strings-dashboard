import assert from "node:assert/strict";

const { resolveAppleCurrentRelease } = await import(
  "../lib/apple-current-release.ts"
);

const appleSongs = ["Никогда не звони", "Guns", "Older song"];

assert.deepEqual(
  resolveAppleCurrentRelease({
    appleSongs,
    spotify: { date: "2026-08-01", title: "Guns" },
    youtubeTopic: { date: "2026-08-02", title: "Guns" }
  }),
  { strategy: "spotify-topic-match", title: "Guns" }
);

assert.deepEqual(
  resolveAppleCurrentRelease({
    appleSongs,
    spotify: { date: "2026-08-01", title: "Никогда не звони" },
    youtubeTopic: { date: "2026-08-01", title: "Никогда не звони" }
  }),
  { strategy: "spotify-topic-match", title: "Никогда не звони" },
  "Unicode song titles must retain their identity during cross-platform matching."
);

assert.deepEqual(
  resolveAppleCurrentRelease({
    appleSongs,
    spotify: { date: "2026-08-01", title: "Guns" },
    youtubeTopic: { date: "2026-08-16", title: "Никогда не звони" }
  }),
  { strategy: "youtube-topic-newer", title: "Никогда не звони" }
);

assert.deepEqual(
  resolveAppleCurrentRelease({
    appleSongs,
    spotify: { date: "2026-08-01", title: "Guns" },
    youtubeTopic: { date: "2026-07-20", title: "Older song" }
  }),
  { strategy: "spotify-release", title: "Guns" },
  "An older Topic publication cannot replace Spotify's actual release date."
);

assert.deepEqual(
  resolveAppleCurrentRelease({
    appleSongs,
    fallbackTitle: "Никогда не звони",
    spotify: { date: "2026-08-01", title: "Not in Apple" },
    youtubeTopic: { date: "2026-08-16", title: "Also absent" }
  }),
  { strategy: "fallback", title: "Никогда не звони" },
  "A cross-platform title must exist in the Apple report before it can be used."
);

console.log("Apple current-release resolution checks passed.");

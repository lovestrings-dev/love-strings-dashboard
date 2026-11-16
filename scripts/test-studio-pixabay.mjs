import assert from "node:assert/strict";
import { normalizePixabayVideoSearch, validatePixabaySearchFilters } from "../lib/studio/pixabay.ts";
assert.equal(validatePixabaySearchFilters({ query: "  night   drive ", category: "music", order: "latest", page: "2", videoType: "film" }).value.query, "night drive");
assert.match(validatePixabaySearchFilters({ query: "x", category: "invalid", order: "popular", page: "1", videoType: "all" }).error, /category/i);
const results = normalizePixabayVideoSearch({ hits: [{ id: 1, pageURL: "https://pixabay.com/videos/id-1/", duration: 12, tags: "night, road", user: "Artist", videos: { medium: { url: "https://cdn.example/video.mp4", thumbnail: "https://cdn.example/poster.jpg", width: 720, height: 1280 }, wide: { url: "https://cdn.example/wide.mp4", thumbnail: "https://cdn.example/wide.jpg", width: 1920, height: 1080 } } }] });
assert.deepEqual(results, [{ id: "1", pageUrl: "https://pixabay.com/videos/id-1/", durationSeconds: 12, tags: "night, road", creator: "Artist", previewUrl: "https://cdn.example/poster.jpg", previewVideoUrl: "https://cdn.example/video.mp4", width: 720, height: 1280 }]);
assert.deepEqual(normalizePixabayVideoSearch({ hits: [{ id: 2, videos: { wide: { url: "x", thumbnail: "y", width: 1920, height: 1080 } } }] }), []);
console.log("Studio Pixabay contract passed.");

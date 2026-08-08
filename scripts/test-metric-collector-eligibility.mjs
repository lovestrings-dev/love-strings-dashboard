import assert from "node:assert/strict";

const { getWorkspaceEnabledCollectors } = await import(
  "../lib/metrics/collector-eligibility.ts"
);

assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    isLegacyWorkspace: true,
    youtubeConfigured: true,
    youtubeTopicConfigured: true
  })].sort(),
  ["google-analytics", "instagram", "spotify", "youtube", "youtube-music"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: false,
    youtubeTopicConfigured: false
  })],
  []
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: true,
    isLegacyWorkspace: false,
    youtubeConfigured: false,
    youtubeTopicConfigured: false
  })],
  ["google-analytics"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: true,
    youtubeTopicConfigured: false
  })],
  ["youtube"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: true })],
  ["youtube-music"]
);

console.log("Metric collector eligibility checks passed.");

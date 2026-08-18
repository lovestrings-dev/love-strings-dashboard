import assert from "node:assert/strict";

const { getWorkspaceEnabledCollectors } = await import(
  "../lib/metrics/collector-eligibility.ts"
);

assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    instagramConfigured: true,
    isLegacyWorkspace: true,
    youtubeConfigured: true,
    youtubeTopicConfigured: true
  })].sort(),
  ["google-analytics", "instagram", "spotify", "youtube", "youtube-music"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    instagramConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: false,
    youtubeTopicConfigured: false
  })],
  []
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: true,
    instagramConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: false,
    youtubeTopicConfigured: false
  })],
  ["google-analytics"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    instagramConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: true,
    youtubeTopicConfigured: false
  })],
  ["youtube"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, instagramConfigured: false, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: true })],
  ["youtube-music"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, instagramConfigured: true, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: false })],
  ["instagram"],
  "a workspace with a selected App B binding can collect Instagram without legacy-workspace eligibility"
);

console.log("Metric collector eligibility checks passed.");

import assert from "node:assert/strict";

const { getWorkspaceEnabledCollectors } = await import(
  "../lib/metrics/collector-eligibility.ts"
);

assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    facebookConfigured: true,
    instagramConfigured: true,
    isLegacyWorkspace: true,
    youtubeConfigured: true,
    youtubeTopicConfigured: true
  })].sort(),
  ["facebook", "google-analytics", "instagram", "spotify", "youtube", "youtube-music"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({
    analyticsConfigured: false,
    facebookConfigured: false,
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
    facebookConfigured: false,
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
    facebookConfigured: false,
    instagramConfigured: false,
    isLegacyWorkspace: false,
    youtubeConfigured: true,
    youtubeTopicConfigured: false
  })],
  ["youtube"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, facebookConfigured: false, instagramConfigured: false, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: true })],
  ["youtube-music"]
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, facebookConfigured: false, instagramConfigured: true, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: false })],
  ["instagram"],
  "a workspace with a selected App B binding can collect Instagram without legacy-workspace eligibility"
);
assert.deepEqual(
  [...getWorkspaceEnabledCollectors({ analyticsConfigured: false, facebookConfigured: true, instagramConfigured: false, isLegacyWorkspace: false, youtubeConfigured: false, youtubeTopicConfigured: false })],
  ["facebook"],
  "a workspace with a selected App B Page can collect Facebook without legacy-workspace eligibility"
);

console.log("Metric collector eligibility checks passed.");

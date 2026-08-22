import assert from "node:assert/strict";

const { calculateAudienceDashboard, normalizeReleaseTitle } = await import(
  "../lib/audience-aggregation.ts"
);

function row({
  date = "2026-08-20",
  metricName,
  notes = null,
  platformSlug,
  source,
  value
}) {
  return { metricName, metricValue: value, notes, platformSlug, snapshotDate: date, source };
}

const estimate = (rows) => calculateAudienceDashboard(rows).estimatedAudience;

assert.equal(
  estimate([
    row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 }),
    row({ metricName: "followers", platformSlug: "instagram", source: "instagram-login-api", value: 900 })
  ]).maximum,
  1000,
  "Facebook/Meta Instagram is canonical when both Instagram sources exist."
);
assert.equal(estimate([row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 })]).lower, 1000, "IG-only works.");
assert.equal(estimate([row({ metricName: "followers", platformSlug: "threads", source: "threads-api", value: 300 })]).lower, 300, "Threads-only works.");
assert.equal(estimate([
  row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 }),
  row({ metricName: "followers", platformSlug: "threads", source: "threads-api", value: 300 })
]).lower, 1030, "IG > Threads uses larger plus 10% smaller.");
assert.equal(estimate([
  row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 300 }),
  row({ metricName: "followers", platformSlug: "threads", source: "threads-api", value: 1000 })
]).lower, 1030, "Threads > IG uses the symmetric rule.");
assert.equal(estimate([row({ metricName: "followers", platformSlug: "facebook", source: "facebook-api", value: 500 })]).lower, 250, "Facebook contributes 50% to lower estimate.");
assert.equal(estimate([
  row({ metricName: "subscribers", platformSlug: "youtube", source: "youtube-data-api", value: 1000 }),
  row({ metricName: "subscribers", platformSlug: "youtube-music", source: "youtube-data-api", value: 200 })
]).lower, 1100, "YouTube Channel > Topic uses larger plus 50% smaller.");
assert.equal(estimate([
  row({ metricName: "subscribers", platformSlug: "youtube", source: "youtube-data-api", value: 200 }),
  row({ metricName: "subscribers", platformSlug: "youtube-music", source: "youtube-data-api", value: 1000 })
]).lower, 1100, "Topic > YouTube Channel uses the symmetric rule.");
assert.equal(estimate([row({ metricName: "subscribers", platformSlug: "youtube", source: "youtube-data-api", value: 200 })]).lower, 200, "One YouTube-family source is used fully.");
assert.equal(estimate([row({ metricName: "followers", platformSlug: "spotify", source: "spotify-audience-current-csv", value: 400 })]).lower, 400, "Spotify contributes 100%.");
assert.deepEqual(estimate([row({ metricName: "active_users_30d", platformSlug: "google-analytics", source: "google-analytics-data-api", value: 50 })]), { lower: 0, maximum: 50, sourceMetrics: ["google-analytics:active_users_30d:google-analytics-data-api"] }, "Website contributes only to maximum.");
assert.deepEqual(estimate([
  row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 }),
  row({ metricName: "followers", platformSlug: "threads", source: "threads-api", value: 300 }),
  row({ metricName: "followers", platformSlug: "facebook", source: "facebook-api", value: 500 }),
  row({ metricName: "subscribers", platformSlug: "youtube", source: "youtube-data-api", value: 100 }),
  row({ metricName: "subscribers", platformSlug: "youtube-music", source: "youtube-data-api", value: 50 }),
  row({ metricName: "followers", platformSlug: "spotify", source: "spotify-audience-current-csv", value: 400 }),
  row({ metricName: "active_users_30d", platformSlug: "google-analytics", source: "google-analytics-data-api", value: 25 })
]).lower, 1805, "Combined lower formula uses all centralized assumptions.");
assert.equal(estimate([
  row({ metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 }),
  row({ metricName: "followers", platformSlug: "threads", source: "threads-api", value: 300 }),
  row({ metricName: "followers", platformSlug: "facebook", source: "facebook-api", value: 500 }),
  row({ metricName: "subscribers", platformSlug: "youtube", source: "youtube-data-api", value: 100 }),
  row({ metricName: "subscribers", platformSlug: "youtube-music", source: "youtube-data-api", value: 50 }),
  row({ metricName: "followers", platformSlug: "spotify", source: "spotify-audience-current-csv", value: 400 }),
  row({ metricName: "active_users_30d", platformSlug: "google-analytics", source: "google-analytics-data-api", value: 25 })
]).maximum, 2375, "Maximum formula includes every connected source exactly once.");
assert.equal(estimate([]), null, "No audience sources produces an empty state.");
const audienceDelta = estimate([
  row({ date: "2026-08-20", metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 100 }),
  row({ date: "2026-08-19", metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 90 })
]);
assert.equal(audienceDelta.lowerDelta, 10, "Comparable audience lower delta is calculated from the previous calendar day.");
assert.equal(audienceDelta.maximumDelta, 10, "Comparable audience maximum delta is calculated separately.");

const carriedAudienceDelta = estimate([
  row({ date: "2026-08-22", metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1010 }),
  row({ date: "2026-08-20", metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1000 }),
  row({ date: "2026-08-18", metricName: "followers", platformSlug: "spotify", source: "spotify-audience-current-csv", value: 590 })
]);
assert.equal(carriedAudienceDelta.lowerDelta, 10, "An older valid Instagram observation is carried into yesterday's state.");
assert.equal(carriedAudienceDelta.maximumDelta, 10, "Providers with different last-observation dates reconstruct one comparison state.");
assert.equal(estimate([
  row({ date: "2026-08-22", metricName: "followers", platformSlug: "instagram", source: "instagram-api", value: 1010 }),
  row({ date: "2026-08-18", metricName: "followers", platformSlug: "spotify", source: "spotify-audience-current-csv", value: 590 })
]).lowerDelta, undefined, "A provider absent before its first observation is not treated as zero.");

const releaseMatch = calculateAudienceDashboard([
  row({ metricName: "latest_release_name", notes: " Guns ", platformSlug: "spotify", source: "spotify-songs-csv", value: 0 }),
  row({ metricName: "latest_release_streams", notes: "GUNS", platformSlug: "spotify", source: "spotify-songs-csv", value: 70 }),
  row({ metricName: "current_release_plays", notes: "guns", platformSlug: "apple-music", source: "apple-music-csv", value: 20 })
]).currentRelease;
assert.equal(releaseMatch.value, 90, "Harmless current-release title differences match.");
assert.deepEqual(releaseMatch.includedPlatforms.sort(), ["apple-music", "spotify"], "Matching music platforms join the release aggregate.");
assert.equal(calculateAudienceDashboard([
  row({ metricName: "latest_release_name", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 0 }),
  row({ metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 70 }),
  row({ metricName: "current_release_plays", notes: "Other song", platformSlug: "apple-music", source: "apple-music-csv", value: 20 })
]).currentRelease.value, 70, "Materially different titles are excluded.");
assert.equal(normalizeReleaseTitle("  GUNS   "), "guns", "Release normalization is deterministic.");

const changedRelease = calculateAudienceDashboard([
  row({ date: "2026-08-20", metricName: "latest_release_name", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 0 }),
  row({ date: "2026-08-20", metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 70 }),
  row({ date: "2026-08-19", metricName: "latest_release_streams", notes: "Older", platformSlug: "spotify", source: "spotify-songs-csv", value: 50 })
]).currentRelease;
assert.equal(changedRelease.delta, undefined, "A release change does not invent a delta.");
assert.equal(calculateAudienceDashboard([
  row({ date: "2026-08-20", metricName: "latest_release_name", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 0 }),
  row({ date: "2026-08-20", metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 70 }),
  row({ date: "2026-08-19", metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 50 })
]).currentRelease.delta, 20, "Same-release previous-day plays delta is calculated.");
assert.equal(calculateAudienceDashboard([
  row({ date: "2026-08-22", metricName: "latest_release_name", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 0 }),
  row({ date: "2026-08-22", metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 78 }),
  row({ date: "2026-08-20", metricName: "latest_release_streams", notes: "Guns", platformSlug: "spotify", source: "spotify-songs-csv", value: 70 })
]).currentRelease.delta, 8, "Same-title current-release values carry forward from the latest observation on or before yesterday.");

assert.equal(calculateAudienceDashboard([
  row({ metricName: "total_channel_views", platformSlug: "youtube", source: "youtube-data-api", value: 9999 }),
  row({ metricName: "total_plays", platformSlug: "youtube-music", source: "youtube-data-api", value: 100 }),
  row({ metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 200 }),
  row({ metricName: "total_catalog_streams", platformSlug: "spotify", source: "spotify-songs-csv", value: 300 })
]).catalogue.value, 600, "Catalogue excludes YouTube Channel views.");
assert.equal(calculateAudienceDashboard([row({ metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 200 })]).catalogue.delta, undefined, "First-day delta is absent.");
assert.equal(calculateAudienceDashboard([
  row({ date: "2026-08-20", metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 220 }),
  row({ date: "2026-08-19", metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 200 })
]).catalogue.delta, 20, "Comparable previous-day catalogue delta is calculated.");
assert.equal(calculateAudienceDashboard([
  row({ date: "2026-08-22", metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 220 }),
  row({ date: "2026-08-20", metricName: "total_plays", platformSlug: "apple-music", source: "apple-music-csv", value: 200 }),
  row({ date: "2026-08-18", metricName: "total_catalog_streams", platformSlug: "spotify", source: "spotify-songs-csv", value: 300 })
]).catalogue.delta, 20, "Cumulative catalogue totals carry forward from each provider's last valid observation.");

console.log("Audience aggregation checks passed.");

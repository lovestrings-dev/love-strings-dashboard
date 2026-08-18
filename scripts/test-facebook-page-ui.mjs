import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const registry = await readFile(new URL("../lib/dashboard-preferences.ts", import.meta.url), "utf8");

assert.match(registry, /id: "platforms\.instagram"[\s\S]*?id: "platforms\.facebook"[\s\S]*?id: "platforms\.youtube"/, "Facebook is registered after Instagram and before YouTube Channel.");
assert.match(page, /platform: "Facebook Page",[\s\S]*?slug: "facebook"[\s\S]*?metricName: "followers"[\s\S]*?metricName: "post_engagements_daily"[\s\S]*?metricName: "post_reactions_daily"/, "Facebook cards consume only the approved stored metrics.");
assert.match(page, /getPlatformCardsForPreferences\(platformStatsData, dashboardPreferences, true\)/, "Dashboard applies child visibility preferences.");
assert.match(page, /getPlatformCardsForPreferences\(platformStatsData,[\s\S]*?, false\)/, "Platforms module keeps ordered child cards available regardless of Dashboard visibility.");
assert.match(page, /getPlatformLastSnapshotImportedAt\(platformMetricRows, "facebook"\)/, "Facebook Last update uses imported_at.");
assert.match(page, /getPlatformMetricTrend\(platformMetricRows, "facebook", "followers", \[\]\)[\s\S]*?getPlatformMetricTrend\(platformMetricRows, "facebook", "post_engagements_daily", \[\]\)[\s\S]*?getPlatformMetricTrend\(platformMetricRows, "facebook", "post_reactions_daily", \[\]\)/, "Facebook graph history uses the generic snapshot-date trend path.");
assert.match(page, /"platforms\.facebook": "facebook"/, "Facebook maps through the shared Platforms child-card mapping.");
assert.match(page, /\.from\("platform_metric_snapshots"\)[\s\S]*?\.eq\("workspace_id", activeWorkspaceId\)/, "Platform snapshot reads stay scoped to the active workspace.");
assert.match(page, /pointsByDate\.set\(row\.snapshot_date, \{[\s\S]*?date: row\.snapshot_date/, "Trend points use snapshot_date as their historical X-axis date.");
assert.match(page, /function PlatformTrendPanelGroup[\s\S]*?charts\.map\(\(chart\) =>/, "The existing reusable graph panel renders every Facebook graph, including empty or one-point series.");

console.log("Facebook Page UI registration and data-contract checks passed.");

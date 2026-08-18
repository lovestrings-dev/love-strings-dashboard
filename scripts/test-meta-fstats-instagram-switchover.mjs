import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const collectors = await readFile(new URL("../lib/metrics/collectors.ts", import.meta.url), "utf8");
const eligibility = await readFile(new URL("../lib/metrics/collector-eligibility.ts", import.meta.url), "utf8");
const refreshRoute = await readFile(new URL("../app/api/metrics/refresh/route.ts", import.meta.url), "utf8");
const cronRoute = await readFile(new URL("../app/api/cron/metrics-refresh/route.ts", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

assert.match(collectors, /import \{[\s\S]*?refreshMetaFstatsInstagramMetrics[\s\S]*?\} from "@\/lib\/metrics\/meta-fstats-instagram-collector"/);
assert.match(collectors, /name: "instagram",[\s\S]*?refreshMetaFstatsInstagramMetrics\(workspaceId, createServiceSupabaseClient\(\)\)/);
assert.doesNotMatch(collectors, /name: "instagram",[\s\S]{0,400}refreshInstagramMetrics\(workspaceId\)/, "normal orchestration must not call the legacy collector");
assert.match(collectors, /hasEligibleMetaFstatsInstagramBinding\(workspaceId, supabase\)/);
assert.match(eligibility, /if \(instagramConfigured\) enabledCollectors\.add\("instagram"\)/);
assert.doesNotMatch(eligibility, /isLegacyWorkspace[\s\S]{0,160}"instagram"/, "Instagram eligibility no longer derives from the legacy workspace flag");
assert.match(refreshRoute, /refreshAllMetricCollectors\(workspaceId\)/);
assert.match(cronRoute, /refreshAllMetricCollectors\(\)/);
assert.equal((dashboard.match(/fetch\("\/api\/metrics\/refresh"/g) ?? []).length, 2, "manual and app-open refresh both call the shared refresh route");

console.log("Meta App B Instagram shared switchover checks passed.");

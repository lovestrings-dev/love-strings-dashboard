import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const collectorSource = await readFile(new URL("../lib/metrics/collectors.ts", import.meta.url), "utf8");

assert.match(
  appSource,
  /function formatPlatformUpdateTimestamp\(date: string, importedAt\?: string\)[\s\S]*?timestamp\.toLocaleDateString\("en-GB"[\s\S]*?timestamp\.toLocaleTimeString\("de-AT"/,
  "Platform cards must use the authoritative imported_at timestamp for both date and time."
);
assert.match(
  appSource,
  /function formatDashboardPlatformUpdateTimestamp\(date: string, importedAt\?: string\)[\s\S]*?importedTimestamp\.toLocaleDateString\("en-GB"[\s\S]*?importedTimestamp\.toLocaleTimeString\("de-AT"/,
  "Dashboard platform cards must use the authoritative imported_at timestamp for both date and time."
);
assert.match(
  collectorSource,
  /const importedAt = new Date\(\)\.toISOString\(\);[\s\S]*?imported_at: importedAt/,
  "Shared collectors must refresh imported_at during a same-day snapshot upsert."
);

console.log("Platform last-update timestamp tests passed.");

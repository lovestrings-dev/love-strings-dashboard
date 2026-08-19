import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  dashboardCardRegistry,
  resolveDashboardPreferences
} from "../lib/dashboard-preferences.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const platforms = dashboardCardRegistry.filter((card) => card.parentId === "platforms");

assert.deepEqual(
  platforms.slice(1, 4).map(({ id, label }) => ({ id, label })),
  [
    { id: "platforms.instagram", label: "Instagram (Business)" },
    { id: "platforms.instagram-creator", label: "Instagram (Creator)" },
    { id: "platforms.threads", label: "Threads" }
  ],
  "Each Meta card has a stable preference identity; the legacy App B key remains intact."
);

const canonical = resolveDashboardPreferences();
const ordered = resolveDashboardPreferences({
  cardOrder: [
    "platforms.threads",
    "platforms.instagram-creator",
    "platforms.facebook",
    "platforms.instagram",
    ...canonical.cardOrder.filter(
      (id) => !["platforms.threads", "platforms.instagram-creator", "platforms.facebook", "platforms.instagram"].includes(id)
    )
  ],
  visibleCards: ["platforms.instagram-creator", "platforms.facebook"]
});
const selectedOrder = ordered.childOrderByParent.platforms ?? [];
const dashboardOrder = selectedOrder.filter((id) => ordered.visibleCards.includes(id));

assert.deepEqual(selectedOrder.slice(0, 4), [
  "platforms.threads",
  "platforms.instagram-creator",
  "platforms.facebook",
  "platforms.instagram"
]);
assert.deepEqual(dashboardOrder.slice(0, 2), [
  "platforms.instagram-creator",
  "platforms.facebook"
], "Dashboard ON/OFF filtering preserves the selected relative order.");
assert.deepEqual(selectedOrder.slice(0, 4), [
  "platforms.threads",
  "platforms.instagram-creator",
  "platforms.facebook",
  "platforms.instagram"
], "Platforms retains OFF cards in the shared selected order.");

assert.match(page, /getPlatformCardsForPreferences\(\n\s*platformStatsData,\n\s*platformMetricRows,\n\s*dashboardPreferences,\n\s*true/, "Dashboard uses the shared ordered resolver with visibility filtering.");
assert.match(page, /getPlatformCardsForPreferences\([\s\S]*?platformMetricRows,[\s\S]*?false\n\s*\)/, "Platforms uses the same resolver without Dashboard visibility filtering.");
assert.match(page, /cardId === "platforms\.instagram-creator"[\s\S]*?getStandaloneInstagramCard\(rows\)/, "Creator Instagram is selected by card identity and its standalone source path.");
assert.match(page, /cardId === "platforms\.threads"[\s\S]*?getThreadsCard\(rows\)/, "Threads is selected by its own card identity and source path.");
assert.match(page, /candidate\.source !== "instagram-login-api"/, "Business Instagram continues excluding standalone Instagram history.");
assert.match(page, /const source = "instagram-login-api"/, "Creator Instagram keeps its own source history.");
assert.match(page, /const source = "threads-api"/, "Threads keeps its own source history.");

console.log("Platform Meta card preference/order tests passed.");

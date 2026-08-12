import assert from "node:assert/strict";
import {
  dashboardCardRegistry,
  resolveDashboardPreferences
} from "../lib/dashboard-preferences.ts";

const canonical = resolveDashboardPreferences();
assert.equal(canonical.isPersonalized, false);
assert.deepEqual(canonical.topLevelOrder, ["events", "focus", "platforms", "marketing", "production", "budget", "roadmap", "qr-codes"]);
assert.deepEqual(canonical.childOrderByParent.platforms, [
  "platforms.audience",
  "platforms.instagram",
  "platforms.youtube",
  "platforms.youtube-topic",
  "platforms.youtube-music",
  "platforms.apple-music",
  "platforms.spotify",
  "platforms.deezer",
  "platforms.amazon",
  "platforms.website"
]);
assert.deepEqual(
  canonical.childOrderByParent.platforms.filter((id) => canonical.visibleCards.includes(id)),
  [
    "platforms.audience",
    "platforms.instagram",
    "platforms.youtube",
    "platforms.youtube-topic",
    "platforms.apple-music",
    "platforms.website"
  ]
);
assert.equal(canonical.visibleCards.includes("platforms.youtube-music"), false);
assert.equal(canonical.visibleCards.includes("platforms.spotify"), false);
assert.equal(canonical.visibleCards.includes("platforms.deezer"), false);
assert.equal(canonical.visibleCards.includes("platforms.amazon"), false);

const customized = resolveDashboardPreferences({
  cardOrder: ["marketing", "events", "marketing.current-song", "platforms.spotify", "platforms", "events", "retired-card"],
  visibleCards: []
});
assert.equal(customized.isPersonalized, true);
assert.deepEqual(customized.topLevelOrder.slice(0, 3), ["marketing", "events", "platforms"]);
assert.deepEqual(customized.visibleCards.filter((id) => ["events", "marketing", "platforms"].includes(id)), []);
assert.equal(customized.childOrderByParent.platforms?.[0], "platforms.spotify");
assert.equal(customized.cardOrder.includes("retired-card"), false);
assert.equal(new Set(customized.cardOrder).size, customized.cardOrder.length);

const allHidden = resolveDashboardPreferences({
  cardOrder: canonical.cardOrder,
  visibleCards: []
});
assert.equal(allHidden.isPersonalized, true);
assert.deepEqual(allHidden.visibleCards, []);

const legacyOrder = dashboardCardRegistry.map((card) => card.id).filter((id) => id !== "platforms.audience");
const futureCard = resolveDashboardPreferences({ cardOrder: legacyOrder, visibleCards: legacyOrder });
assert.equal(futureCard.childOrderByParent.platforms?.at(-1), "platforms.audience");
assert.equal(futureCard.visibleCards.includes("platforms.audience"), true);

const reset = resolveDashboardPreferences({ cardOrder: [], visibleCards: [] });
assert.deepEqual(reset, canonical);

console.log("Dashboard preference resolver tests passed.");

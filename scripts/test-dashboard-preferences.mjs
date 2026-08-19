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
  "platforms.instagram-creator",
  "platforms.threads",
  "platforms.facebook",
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
    "platforms.instagram-creator",
    "platforms.threads",
    "platforms.facebook",
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
assert.equal(canonical.visibleCards.includes("platforms.facebook"), true);

const facebookOff = resolveDashboardPreferences({
  cardOrder: canonical.cardOrder,
  visibleCards: canonical.visibleCards.filter((id) => id !== "platforms.facebook")
});
assert.equal(facebookOff.visibleCards.includes("platforms.facebook"), false, "Facebook OFF is a Dashboard visibility preference");
assert.equal(facebookOff.childOrderByParent.platforms.includes("platforms.facebook"), true, "Facebook remains a Platforms child when Dashboard visibility is OFF");
const facebookFirst = resolveDashboardPreferences({
  cardOrder: ["platforms.facebook", ...canonical.cardOrder.filter((id) => id !== "platforms.facebook")],
  visibleCards: canonical.visibleCards
});
assert.equal(facebookFirst.childOrderByParent.platforms?.[0], "platforms.facebook", "one child order controls Facebook positioning");

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

const legacyOrder = dashboardCardRegistry
  .map((card) => card.id)
  .filter((id) => !["platforms.audience", "platforms.instagram-creator", "platforms.threads"].includes(id));
const futureCard = resolveDashboardPreferences({ cardOrder: legacyOrder, visibleCards: legacyOrder });
assert.deepEqual(futureCard.childOrderByParent.platforms?.slice(-3), [
  "platforms.audience",
  "platforms.instagram-creator",
  "platforms.threads"
]);
assert.equal(futureCard.visibleCards.includes("platforms.audience"), true);
assert.equal(futureCard.visibleCards.includes("platforms.instagram-creator"), true);
assert.equal(futureCard.visibleCards.includes("platforms.threads"), true);

const reset = resolveDashboardPreferences({ cardOrder: [], visibleCards: [] });
assert.deepEqual(reset, canonical);

console.log("Dashboard preference resolver tests passed.");

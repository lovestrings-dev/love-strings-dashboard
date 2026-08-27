import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8")
]);

const dashboardCard = page.match(/function DashboardAudienceCard[\s\S]*?\n}\n\nfunction PlatformsAudienceCard/)?.[0] ?? "";
const platformsCard = page.match(/function PlatformsAudienceCard[\s\S]*?\n}\n\nconst emptyAudienceEvolutionHistory/)?.[0] ?? "";

for (const card of [dashboardCard, platformsCard]) {
  assert.doesNotMatch(card, /Estimated \/ overlap-adjusted|Music platforms only|Current Release Plays<\/h4>/);
  assert.match(card, /className="audience-estimated-value"/);
  assert.match(card, /<h4>Est\. Total Audience<\/h4>/);
  assert.match(card, /<h4>\{release\.title\} Total Plays<\/h4>/);
  assert.match(card, /<AudienceInlineDelta value=\{release\.delta\}/);
  assert.match(card, /<AudienceInlineDelta value=\{catalogue\.delta\}/);
}
assert.match(page, /platform-metric-delta-\$\{direction\}/);
assert.match(styles, /\.audience-dashboard-child strong \{[\s\S]*display: flex;/);
assert.match(styles, /\.audience-platform-child strong \{[\s\S]*display: flex;/);
assert.match(styles, /\.audience-platform-child \.audience-estimated-value \{[\s\S]*font-size: clamp\(18px, 5vw, 21px\)/);
assert.match(styles, /\.platform-grid-dashboard \.platform-metrics dd \{[\s\S]*font-size: clamp\(18px, 5vw, 20px\)/);
assert.match(styles, /\.platform-metrics dd \{[\s\S]*font-size: clamp\(18px, 5vw, 21px\)/);
assert.match(styles, /\.budget-metric-card \{[\s\S]*display: flex;[\s\S]*flex-direction: column;/);
assert.match(styles, /\.budget-metric-card > strong \{[\s\S]*font-size: clamp\(18px, 5vw, 21px\);[\s\S]*order: -1;/);
assert.match(styles, /\.dashboard-budget-grid \.budget-metric-card > strong \{[\s\S]*font-size: clamp\(18px, 5vw, 20px\)/);

console.log("Audience card UI checks passed.");

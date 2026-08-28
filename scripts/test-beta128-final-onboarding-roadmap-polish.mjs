import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, setup, styles] = await Promise.all([
  read("app/page.tsx"),
  read("app/initial-workspace-setup.tsx"),
  read("app/globals.css")
]);

assert.match(page, /window\.setTimeout[\s\S]*platform-card-youtube[\s\S]*cardTop[\s\S]*window\.scrollTo/, "guided Google waits for the mounted card then calculates a viewport position.");
assert.match(page, /window\.matchMedia\("\(max-width: 540px\)"\)/, "mobile uses a practical near-top focus position.");
assert.match(page, /Math\.min\(card\.clientHeight, window\.innerHeight \* 0\.72\)/, "desktop centering accounts for a card taller than the usable viewport.");
assert.match(setup, /cardClassName="initial-workspace-setup-card"/, "mandatory setup has a purpose-fit ArtistDeck card.");
assert.match(setup, /releaseFrequency \? " is-selected" : ""/, "cadence selection state is visible.");
assert.match(setup, /distributorAnswer \? " is-selected" : ""/, "Distributor selection state is visible.");
assert.match(styles, /\.initial-workspace-setup-choice\.is-selected/, "selected setup choices have a dedicated visual state.");
assert.match(styles, /\.artistdeck-system-card \.initial-workspace-setup-form button:disabled/, "the Finish button retains an explicit disabled treatment.");
assert.match(page, /roadmap-horizon-summary/, "main Roadmap and Auto Plans communicate their planning horizon.");
assert.match(page, /RoadmapMonthStrip months=\{months\.filter\(\(month\) => month\.phase === phase\.phaseNumber\)\}/, "each Auto Plan renders its own complete month strip.");
assert.match(page, /month\.planned > month\.released && month\.id < getViennaDateKey\(\)\.slice\(0, 7\)/, "warning-red is reserved for a past unresolved scheduled release.");
assert.doesNotMatch(page, /month\.id <= getViennaDateKey\(\)\.slice\(0, 7\)[\s\S]*return "missed"/, "an empty past month is not misclassified as missed.");
assert.match(styles, /\.roadmap-box-planned \{\n  background: #fff5e5;/, "empty plan intervals render as deliberate pale-orange planning horizon, not white holes.");
assert.match(styles, /\.roadmap-box-missed \{\n  background: #e34b4b;/, "genuine warning treatment remains available.");

console.log("Beta 1.28 final onboarding Roadmap polish contracts passed.");

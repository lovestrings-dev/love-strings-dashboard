import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css, page] = await Promise.all([
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8")
]);

assert.doesNotMatch(
  css,
  /html,\s*body,\s*\.dashboard-shell,\s*\.workspace\s*\{\s*max-width:\s*100vw;/,
  "Mobile document geometry must not be constrained with 100vw."
);
assert.match(
  css,
  /\.dashboard-shell\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  "The mobile app shell must allow its only grid column to shrink."
);
assert.match(
  css,
  /\.platform-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  "The single-column mobile Platforms grid must not inherit min-content width."
);
assert.match(
  css,
  /\.nav-scroll-shell\s*\{[\s\S]*?contain:\s*paint;[\s\S]*?overflow:\s*clip;/,
  "The mobile nav needs an independent paint-clipping owner."
);
assert.match(
  css,
  /\.nav-list\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overscroll-behavior-x:\s*contain;/,
  "The mobile nav must remain horizontally scrollable without chaining to the page."
);
assert.match(page, /<div className="nav-scroll-shell">\s*<nav className="nav-list">/, "The mobile nav must have its own clipping wrapper.");
assert.match(
  css,
  /\.apple-import-button\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?position:\s*relative;/,
  "CSV import buttons must contain their native file inputs."
);
assert.match(
  css,
  /\.apple-import-button input\s*\{[\s\S]*?clip-path:\s*inset\(50%\);[\s\S]*?overflow:\s*hidden;[\s\S]*?position:\s*absolute;/,
  "CSV native inputs must be visually hidden and clipped rather than allowed to expose intrinsic width."
);
assert.match(page, /function AppleMusicCsvImportControl[\s\S]*?className="apple-import-button"[\s\S]*?type="file"/, "Apple CSV import must retain its native file chooser.");
assert.match(page, /function SpotifyCsvImportControl[\s\S]*?className="apple-import-button"[\s\S]*?type="file"/, "Spotify CSV import must retain its native file chooser.");
assert.match(
  css,
  /\.fq-segment\.is-status-menu-open\s*\{\s*overflow:\s*visible;[\s\S]*?z-index:\s*3;/,
  "An open Focus Queue segment must expose and stack its status menu."
);
assert.match(
  page,
  /openStatusTaskId \? " is-status-menu-open" : ""/,
  "Focus Queue stacking must use an explicit class instead of relying on :has()."
);
assert.doesNotMatch(page, /Sprint Dashboard/, "No user-facing Sprint Dashboard label remains in the app.");

console.log("iPhone layout regression checks passed.");

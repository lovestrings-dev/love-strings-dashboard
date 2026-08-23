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

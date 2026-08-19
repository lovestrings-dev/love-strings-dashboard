import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.match(page, /Instagram via Facebook Page/, "App B Instagram receives an explicit user-facing label");
assert.match(page, /Standalone Instagram/, "App A Instagram receives a distinct user-facing card");
assert.match(page, /instagram-login-api/, "App A presentation filters by its collector source");
assert.match(page, /instagram-standalone/, "Standalone card has an independent UI identity");
assert.match(page, /getStandaloneInstagramCard\(platformMetricRows\)/, "Dashboard and Platforms derive the card from historical rows");
console.log("Meta App A standalone Instagram presentation tests passed.");

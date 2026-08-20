import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.match(page, /Instagram \(Business\)/, "App B Instagram receives its preference/card label");
assert.match(page, /Instagram \(Creator\)/, "App A Instagram receives a distinct preference/card label");
assert.match(page, /instagram-login-api/, "App A presentation filters by its collector source");
assert.match(page, /instagram-standalone/, "Standalone card has an independent UI identity");
assert.match(page, /cardId === "platforms\.instagram-creator"[\s\S]*?getStandaloneInstagramCard\(rows\)/, "Creator Instagram is derived from historical rows through its own preference identity");
assert.doesNotMatch(
  page,
  /if \(!rows\.some\(\(row\) => getSingle\(row\.platforms\)\?\.slug === "instagram" && row\.source === source\)\) return \[\];/,
  "Creator Instagram visibility must not depend on a metric snapshot being present."
);
console.log("Meta App A standalone Instagram presentation tests passed.");

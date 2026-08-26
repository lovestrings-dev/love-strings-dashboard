import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeProductionDateForPersistence } from "../lib/production-date-format.ts";

assert.equal(normalizeProductionDateForPersistence("2026-09-04"), "2026-09-04", "server-derived ISO dates must remain canonical");
assert.equal(normalizeProductionDateForPersistence("04/09/2026"), "2026-09-04", "DateInput values must normalize at the API boundary");
assert.equal(normalizeProductionDateForPersistence("2026-02-30"), null);
assert.equal(normalizeProductionDateForPersistence("30/02/2026"), null);

const route = await readFile(new URL("../app/api/production/songs/route.ts", import.meta.url), "utf8");
assert.match(route, /normalizeProductionDateForPersistence\(canonicalSong\.deadline\)/);
assert.match(route, /normalizeProductionDateForPersistence\(step\.deadline\)/);
const v1SavePath = route.slice(route.indexOf("async function saveProductionV1SongAtomically"), route.indexOf("function normalizeBudgetLines"));
assert.doesNotMatch(v1SavePath, /formatInputDateForDatabase/);

console.log("Production V1 ISO date-boundary regression checks passed.");

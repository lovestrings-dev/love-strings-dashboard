import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
assert.match(page,/cardId === "platforms\.threads"[\s\S]*?getThreadsCard\(rows\)/);
assert.match(page,/threads-api/);
assert.match(page,/Profile Views/);
assert.match(page,/platform.slug === "threads"/);
assert.doesNotMatch(
  page,
  /if \(!rows\.some\(\(row\) => getSingle\(row\.platforms\)\?\.slug === "threads" && row\.source === source\)\) return \[\];/,
  "Threads card visibility must not depend on a metric snapshot being present."
);
console.log("Meta App A Threads presentation tests passed.");

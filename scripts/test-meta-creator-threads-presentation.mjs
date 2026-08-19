import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
assert.match(page,/getThreadsCard\(platformMetricRows\)/);
assert.match(page,/threads-api/);
assert.match(page,/Profile Views/);
assert.match(page,/platform.slug === "threads"/);
console.log("Meta App A Threads presentation tests passed.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(page, /get\("layoutDebug"\) === "1"/, "The diagnostic must be explicitly query-gated.");
assert.match(page, /document\.documentElement\.scrollWidth/, "The report must include document scroll width.");
assert.match(page, /document\.body\.scrollWidth/, "The report must include body scroll width.");
assert.match(page, /getBoundingClientRect\(\)/, "The report must measure rendered element bounds.");
assert.match(page, /scrollWidth > details\.clientWidth \+ 1/, "The scan must flag internal overflow with a tolerance.");
assert.match(page, /navigator\.clipboard\.writeText/, "The report must be copyable.");
assert.match(page, /createPortal\(/, "The panel must render outside the application layout tree.");
assert.match(styles, /\.layout-debug-panel\s*\{[\s\S]*?position: fixed;/, "The panel must be fixed.");
assert.match(styles, /\.layout-debug-panel\s*\{[\s\S]*?left: 8px;[\s\S]*?right: 8px;/, "The panel must fit safely within the viewport.");

console.log("Layout diagnostic panel contract passed.");

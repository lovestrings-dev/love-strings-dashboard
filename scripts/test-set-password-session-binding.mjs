import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/set-password/page.tsx", import.meta.url), "utf8");
assert.match(page, /const callback = currentAuthCallback\(query, hash\);[\s\S]*if \(callback\?\.kind === "code"\)/);
assert.match(page, /exchangeCodeForSession\(callback\.code\)/);
assert.match(page, /else \{[\s\S]*getSession\(\)/);
assert.doesNotMatch(page, /existing \?\? initial\.session/);
assert.match(page, /callbackNeedsPassword\(callback\)/);
assert.match(page, /never let User A's existing session consume User B's link/);
assert.match(page, /This sign-in link could not be verified\. It may already have been used/);
assert.doesNotMatch(page, /provisioning-invitations/);
console.log("Set-password callback/session binding checks passed.");

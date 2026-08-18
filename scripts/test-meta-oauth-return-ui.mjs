import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { cleanConsumedFstatsLoginContinuation, hasFstatsLoginContinuation } = await import("../lib/meta/fstats-login-continuation.ts");
const component = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

const firstReturn = "http://localhost:3000/?settings=general&meta=fstats-login-selection-required&campaign=flowers#_=_";
assert.equal(hasFstatsLoginContinuation(firstReturn), true, "a new Meta OAuth return is detected");
assert.equal(cleanConsumedFstatsLoginContinuation(firstReturn), "/?campaign=flowers", "only transient Meta/settings/fragment state is removed");
assert.equal(hasFstatsLoginContinuation("http://localhost:3000/?campaign=flowers"), false, "the consumed clean URL does not retrigger Meta");
assert.equal(hasFstatsLoginContinuation(firstReturn), true, "a genuinely new OAuth return is detected again");

assert.equal(
  cleanConsumedFstatsLoginContinuation("https://example.test/dashboard?settings=user&meta=unrelated&campaign=flowers#section"),
  "/dashboard?settings=user&meta=unrelated&campaign=flowers#section",
  "unrelated settings, query state, and fragments are preserved",
);
assert.equal(
  cleanConsumedFstatsLoginContinuation("https://example.test/dashboard?settings=general&meta=fstats-login-error#_=_"),
  "/dashboard",
  "failed Meta OAuth continuations are also consumable after their UI is mounted",
);

assert.match(component, /useState\([\s\S]*typeof window !== "undefined" && hasFstatsLoginContinuation\(window\.location\.href\)/, "continuation state is captured once per mounted OAuth return without server access to window");
assert.match(component, /!data \|\| !isOpen \|\| requestState === "loading"/, "focus waits for loaded state and the open card");
assert.match(component, /section\.focus\(\{ preventScroll: true \}\)[\s\S]*section\.scrollIntoView/, "focus and scroll occur on the mounted Meta card");
assert.match(component, /history\.replaceState\([\s\S]*cleanConsumedFstatsLoginContinuation/, "cleanup is an in-place history replacement");
assert.doesNotMatch(component, /location\.(?:assign|replace)\([^)]*cleanConsumedFstatsLoginContinuation/, "continuation cleanup cannot cause a full reload");
assert.match(component, /metaContinuationConsumed\.current = true[\s\S]*setHasMetaContinuation\(false\)/, "successful handling clears both guard and state");
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.meta-onboarding-panel \.google-service-row > button,[\s\S]*\.meta-row-actions button[\s\S]*min-height: 44px;[\s\S]*width: 100%;/, "mobile workflow buttons are full-width and touch-friendly");
assert.doesNotMatch(styles, /\.meta-access-actions[^}]*width:\s*100%/s, "access-management service buttons remain compact");

console.log("Meta OAuth return/focus/mobile UI tests passed.");

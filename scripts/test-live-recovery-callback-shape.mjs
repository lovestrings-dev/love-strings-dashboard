import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { currentAuthCallback } from "../lib/auth-callback.ts";

const [page, browserClient] = await Promise.all([
  readFile(new URL("../app/set-password/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/browser.ts", import.meta.url), "utf8"),
]);

// Supabase production recovery confirmation redirects to the fixed path with
// an implicit session in the fragment, rather than a PKCE code in the query.
const callback = currentAuthCallback(
  new URLSearchParams("recovery=1"),
  new URLSearchParams("access_token=redacted-access&refresh_token=redacted-refresh&type=recovery&expires_in=3600"),
);
assert.deepEqual(callback, {
  kind: "hash",
  accessToken: "redacted-access",
  refreshToken: "redacted-refresh",
  type: "recovery",
});

assert.match(browserClient, /createBrowserSupabaseCallbackClient\(\)[\s\S]*auth: \{ detectSessionInUrl: false \}/, "Callback client retains the recovery hash for explicit validation");
assert.match(page, /createBrowserSupabaseCallbackClient\(\)/, "Set-password uses the callback-specific client while establishing a callback session");
assert.match(page, /callback\?\.kind === "hash"[\s\S]*setSession\(\{ access_token: callback\.accessToken, refresh_token: callback\.refreshToken \}\)/, "The real implicit recovery callback establishes its session explicitly");
assert.match(page, /else if \(callback\?\.kind === "hash"\)[\s\S]*setSession\([\s\S]*else \{[\s\S]*getSession\(\)/, "A callback session is established before any unrelated persisted session is considered");
assert.match(page, /if \(!session\) return rejectCallback\(\)/, "Actually invalid or expired callbacks still fail through the safe invalid-link state");
assert.match(page, /if \(ordinary && callbackNeedsPassword\(callback\)\)[\s\S]*else if \(!ordinary && callback && \(isRecoveryDestination \|\| callback\.type === "recovery"\)\)/, "Workspace invitations retain precedence and recovery stays isolated");
assert.doesNotMatch(page, /if \(!ordinary\)[\s\S]*\/api\/invitations\/accept/, "Recovery cannot call workspace invitation acceptance");

console.log("Live recovery callback shape regression checks passed.");

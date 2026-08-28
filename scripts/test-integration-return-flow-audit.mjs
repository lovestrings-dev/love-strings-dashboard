import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, googleConnect, googleCallback, googleOauth, metaSettings, fstatsConnect, fstatsCallback, instagramConnect, instagramCallback, threadsConnect, threadsCallback, oauthAttempts] = await Promise.all([
  read("app/page.tsx"),
  read("app/api/integrations/google/connect/route.ts"),
  read("app/api/integrations/google/callback/route.ts"),
  read("lib/google/oauth.ts"),
  read("app/meta-page-connection-settings.tsx"),
  read("app/api/integrations/meta/fstats-login/connect/route.ts"),
  read("app/api/integrations/meta/fstats-login/callback/route.ts"),
  read("app/api/integrations/meta/instagram/connect/route.ts"),
  read("app/api/integrations/meta/instagram/callback/route.ts"),
  read("app/api/integrations/meta/threads/connect/route.ts"),
  read("app/api/integrations/meta/threads/callback/route.ts"),
  read("lib/oauth-attempt.ts"),
]);

assert.match(googleConnect, /url\.searchParams\.set\("settings", "general"\)[\s\S]*url\.searchParams\.set\("google", result\)/, "Google connect failures return through General Settings");
assert.match(googleConnect, /google_message/, "Google authorization-start failures preserve a visible safe error message");
assert.match(googleCallback, /url\.searchParams\.set\("settings", "general"\)/, "Google callbacks return to General Settings");
assert.match(googleCallback, /state !== savedState/, "Google callback keeps CSRF state validation");
assert.match(googleCallback, /savedOrigin !== request\.nextUrl\.origin/, "Google callback validates its saved app origin");
assert.match(googleCallback, /savedWorkspaceId !== workspaceId/, "Google callback validates the active workspace");
assert.match(googleCallback, /providerError === "access_denied"/, "Google cancellation or denial is classified before returning");
assert.match(googleCallback, /Google authorization was cancelled or permission was denied\./, "Google cancellation returns a meaningful status message");
assert.match(page, /setActiveGeneralSettingsPanel\("google"\)/, "Google returns open the Google parent panel");
assert.match(page, /googleServicesRef\.current\?\.scrollIntoView/, "Google returns scroll to the Google panel");
assert.match(page, /parameters\.get\("google_message"\)/, "Google return errors are shown in the normal Google Services status area");
assert.match(page, /hasHandledGoogleReturn/, "a handled Google return keeps its status through development Strict Mode");
assert.match(page, /googleConnectionLoadVersion\.current/, "Google property updates remain guarded against stale status loads");
assert.match(page, /guidance_return[\s\S]*refreshGoogleConnection\(\)[\s\S]*refreshGuidanceStatus\(\)/, "Guided Google returns refresh both the connection card and canonical Guidance status");
assert.match(page, /setActiveSection\("Platforms"\)/, "Guided Google returns open the Platforms module");
assert.match(page, /activeSection !== "Platforms"[\s\S]*platform-card-youtube[\s\S]*scrollIntoView/, "Guided Google returns focus the YouTube Platforms card after it renders");
assert.match(googleOauth, /analytics\.readonly/, "Analytics authorization remains read-only");
assert.match(googleOauth, /youtube\.readonly/, "YouTube authorization remains read-only");

for (const [name, source] of [["Facebook", fstatsConnect], ["Instagram", instagramConnect], ["Threads", threadsConnect]]) {
  assert.match(source, /returnTarget/, `${name} connect flow uses a constrained OAuth return target`);
}
assert.match(fstatsConnect, /url\.searchParams\.set\("settings", "general"\)/, "Facebook connect-start failures return to General Settings");
assert.match(instagramConnect, /oauth", "creator-social-instagram-error"/, "Instagram connect-start failures return to General Settings");
assert.match(threadsConnect, /oauth", "creator-social-threads-error"/, "Threads connect-start failures return to General Settings");
assert.match(fstatsCallback, /consumeOAuthAttempt/, "Facebook callback consumes the validated OAuth attempt before returning");
assert.match(fstatsCallback, /returnPath = attempt\.returnPath/, "Facebook callback returns through the validated stored continuation");
assert.match(instagramCallback, /createOAuthResultReturnUrl/, "Instagram callback returns through the validated continuation helper");
assert.match(threadsCallback, /createOAuthResultReturnUrl/, "Threads callback returns through the validated continuation helper");
assert.match(oauthAttempts, /getSafeOAuthReturnPath/, "OAuth return paths are restricted to safe internal destinations");
assert.match(metaSettings, /onOpen\(\);[\s\S]*await loadCreatorInstagram\(\)/, "Instagram returns open Meta and reload canonical state");
assert.match(metaSettings, /onOpen\(\);[\s\S]*await loadCreatorThreads\(\)/, "Threads returns open Meta and reload canonical state");
assert.match(metaSettings, /section\.focus\([\s\S]*section\.scrollIntoView/, "Facebook returns focus and scroll after reconciliation");
assert.match(metaSettings, /target\.focus\([\s\S]*target\.scrollIntoView/, "Creator returns focus and scroll to the relevant child");
assert.match(page, /Connected: \$\{metaConnectedServices\.join\(", "\)\}/, "Collapsed Meta summary lists only connected services");
assert.match(metaSettings, /data\?\.stage === "connected"/, "Facebook is counted only after its connection reaches the connected state");

console.log("Integration return-flow audit checks passed.");

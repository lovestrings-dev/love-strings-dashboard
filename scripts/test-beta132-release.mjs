import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.equal(manifest.version, "1.32.0-beta.1");
assert.match(page, /const appVersionLabel = "Beta 1\.32";/);

// Explicit offline allowlist: never discover or run live fixture/mutation scripts.
const scripts = [
  "test-appearance.mjs",
  "test-header-account-menu-ui.mjs",
  "test-guidance-visual-helper.mjs",
  "test-beta128-onboarding-acceptance-regressions.mjs",
  "test-beta128-dimasounder-acceptance-polish.mjs",
  "test-set-password-session-binding.mjs",
  "test-youtube-topic-discovery.mjs",
  "test-custom-domain-oauth.mjs",
  "test-oauth-attempts.mjs",
  "test-meta-fstats-login-oauth.mjs",
  "test-meta-creator-instagram-oauth.mjs",
  "test-meta-creator-threads-oauth.mjs",
  "test-integration-return-flow-audit.mjs",
  "test-password-recovery-flow.mjs",
  "test-marketing-campaign-creation-dates.mjs",
  "test-platform-google-connection.mjs",
  "test-platform-evolution.mjs",
  "test-spotify-evolution.mjs",
  "test-spotify-audience-history.mjs",
  "test-audience-aggregation.mjs",
  "test-facebook-page-ui.mjs",
  "test-platform-card-preferences.mjs",
  "test-dashboard-preferences.mjs",
  "test-iphone-layout-regressions.mjs",
  "test-date-input.mjs",
  "test-platform-last-update.mjs",
  "test-apple-current-release-resolution.mjs"
];
let failed = 0;
for (const script of scripts) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", `scripts/${script}`], { cwd: root, encoding: "utf8" });
  if (result.status === 0) console.log(`PASS ${script}`);
  else {
    failed++;
    console.error(`FAIL ${script}\n${result.stdout ?? ""}${result.stderr ?? ""}`);
    if (result.error) console.error(result.error.message);
  }
}
console.log(`Beta 1.32 offline regressions: ${scripts.length - failed}/${scripts.length} passed.`);
if (failed) process.exitCode = 1;

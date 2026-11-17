import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.equal(manifest.version, "1.36.0-beta.1");
assert.ok(page.includes('const appVersionLabel = "Beta 1.36";'));
assert.ok(page.includes('availableProcesses={["Audio", "Video", "Overlays", "Export"]}'));
assert.ok(page.includes("Studio Demo"));

const scripts = [
  "test-production-snapshot-reconciliation.mjs",
  "test-production-template-v1-scheduler.mjs",
  "test-production-v1-date-format-boundary.mjs",
  "test-production-v1-identity-preserving-save.mjs",
  "test-production-sharing.mjs",
  "test-production-past-release.mjs",
  "test-dashboard-production-preview-ui.mjs",
  "test-pull-to-refresh.mjs",
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
  "test-apple-current-release-resolution.mjs",
  "test-studio-composition.mjs",
  "test-studio-pixabay.mjs",
  "test-studio-storage-signing.mjs",
  "test-studio-video-thumbnail.mjs",
  "test-studio-render-jobs.mjs",
  "test-studio-render-batch.mjs",
  "test-studio-media-retention.mjs",
  "test-studio-overlays.mjs",
  "test-studio-pixabay-render.mjs"
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

console.log(`Beta 1.36 offline regressions: ${scripts.length - failed}/${scripts.length} passed.`);
if (failed) process.exitCode = 1;

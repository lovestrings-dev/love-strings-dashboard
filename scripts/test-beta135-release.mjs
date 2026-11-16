import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const audioPlayer = await readFile(new URL("../app/components/audio-player.tsx", import.meta.url), "utf8");
const trimmer = await readFile(new URL("../app/components/media-trimmer.tsx", import.meta.url), "utf8");
const pixabayRoute = await readFile(new URL("../app/api/studio/pixabay/search/route.ts", import.meta.url), "utf8");
const composition = await readFile(new URL("../lib/studio/composition.ts", import.meta.url), "utf8");
const localVideoLibrary = await readFile(new URL("../lib/studio/local-video-library.ts", import.meta.url), "utf8");

assert.equal(manifest.version, "1.35.0-beta.1");
assert.match(page, /const appVersionLabel = "Beta 1\.35";/);
assert.match(page, /function StudioAudioEditor/);
assert.match(page, /function StudioVideoEditor/);
assert.match(page, /availableProcesses=\{\["Audio", "Video"\]\}/);
assert.match(page, /confirmedLocalVideos\.length \+ confirmedPixabayClips\.length < 4/);
assert.match(page, /onAudioPreviewSourceChange/);
assert.match(audioPlayer, /playExcerpt/);
assert.match(trimmer, /onTrimSelectionCommit/);
assert.match(trimmer, /left: `\$\{toVisiblePercent\(0\)\}%`/);
assert.match(pixabayRoute, /validatePixabaySearchFilters/);
assert.match(composition, /validateComposition/);
assert.match(page, /workspaceStorageKey\(activeWorkspaceId, "studio-audio-snippets-v1"\)/);
assert.match(page, /workspaceStorageKey\(workspaceId, "studio-confirmed-pixabay-videos-v1"\)/);
assert.doesNotMatch(page, /artistdeck-studio-audio-snippets-v1/);
assert.match(localVideoLibrary, /artistdeck-studio-workspace/);
assert.match(localVideoLibrary, /listRecentStudioVideos\(workspaceId: string\)/);

const scripts = ["test-studio-composition.mjs", "test-studio-pixabay.mjs"];
let failed = 0;
for (const script of scripts) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", `scripts/${script}`], { cwd: root, encoding: "utf8" });
  if (result.status === 0) console.log(`PASS ${script}`);
  else {
    failed++;
    console.error(`FAIL ${script}\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
}

console.log(`Beta 1.35 Studio contracts: ${scripts.length - failed}/${scripts.length} passed.`);
if (failed) process.exitCode = 1;

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles, migration] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608270001_seed_virgin_workspace_other_tasks.sql", import.meta.url), "utf8")
]);

assert.match(page, /const activeSongs = orderedSongs\.filter\(\(song\) => !isRoadmapSongReleased\(song\)\)/);
assert.match(page, /Show released songs \(\{releasedSongs\.length\}\)/);
assert.match(page, /getProductionDeadlineSortTime\(firstSong\.releaseDate\)/);
const nativePickerStyles = styles.match(/\.date-input \.date-input-native-picker \{[^}]*\}/)?.[0] ?? "";
assert.match(nativePickerStyles, /height: 32px/);
assert.match(nativePickerStyles, /width: 32px/);
assert.match(nativePickerStyles, /z-index: 2/);
assert.doesNotMatch(nativePickerStyles, /pointer-events: none/);
assert.match(page, /const selectionVersion = \+\+googleConnectionLoadVersion\.current/);
assert.match(page, /fetch\("\/api\/integrations\/google\/status", \{ cache: "no-store" \}\)/);
assert.match(page, /formatPlatformMetricDisplay\(metric\.value\)/);
assert.match(migration, /starter-user-artist-names-and-logos/);
assert.match(migration, /on conflict \(workspace_id, stable_key\) do nothing/);
assert.match(migration, /finalize_pending_workspace/);

console.log("Beta 1.26 Batch A Production/storage UI checks passed.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [setup, page, styles, migration] = await Promise.all([
  readFile(new URL("../app/initial-workspace-setup.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608280005_repair_fresh_workspace_onboarding_v1_defaults.sql", import.meta.url), "utf8")
]);

assert.match(setup, /useState<ReleaseFrequency \| "">\(""\)/, "release cadence begins unselected");
assert.match(setup, /useState<DistributorAnswer \| "">\(""\)/, "Distributor answer begins unselected");
assert.match(setup, /disabled=\{!selectionsComplete \|\| submitting\}/, "Finish is disabled until both explicit choices are made");
assert.match(setup, /Choose release cadence/, "release cadence requires an explicit placeholder replacement");
assert.match(setup, /Choose distributor answer/, "Distributor requires an explicit placeholder replacement");
assert.match(setup, /initial-workspace-setup-card/, "setup uses its dedicated ArtistDeck card layout.");
assert.match(setup, /initial-workspace-setup-choice\$\{releaseFrequency/, "a selected cadence receives clear visual feedback.");
assert.match(setup, /initial-workspace-setup-choice\$\{distributorAnswer/, "a selected Distributor choice receives clear visual feedback.");
assert.match(styles, /\.artistdeck-system-card\.initial-workspace-setup-card[\s\S]*max-width: 560px/, "setup has room for its two mandatory decision cards.");
assert.match(styles, /\.artistdeck-system-card \.initial-workspace-setup-form button:disabled[\s\S]*cursor: not-allowed/, "the disabled Finish state has the intended non-actionable affordance.");
assert.match(page, /starter-upload-user-artist-logos", 0/, "Focus Queue gives logos the first canonical seeded position");
assert.match(page, /starter-create-custom-task", 1/, "Focus Queue gives custom task the second canonical seeded position");
assert.match(page, /starter-upload-streaming-csv", 2/, "Focus Queue gives CSV upload the third canonical seeded position");
assert.match(migration, /'license-v1'.*false, 3, 0/, "new workspace templates disable License without a cost");
assert.match(migration, /'cover-art-v1'.*14 then 3 else 6/, "Cover Art preserves the 14\/28-day V1 timing window");
assert.match(migration, /Unexpected pending-workspace finalization definition/, "finalization repair is fail-closed");

console.log("Beta 1.28 first-Admin onboarding repair contracts passed.");

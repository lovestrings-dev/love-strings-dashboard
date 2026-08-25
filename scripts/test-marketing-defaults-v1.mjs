import assert from "node:assert/strict";
import fs from "node:fs";
import { addMarketingDays, fallbackMarketingTimingDefaults, proposedGeneralCampaignEndDate, songCampaignOffsets, validateMarketingTimingDefaults } from "../lib/marketing-defaults.ts";

assert.deepEqual(songCampaignOffsets(fallbackMarketingTimingDefaults), [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(addMarketingDays("2026-09-10", songCampaignOffsets(fallbackMarketingTimingDefaults)[0]), "2026-09-07");
assert.equal(addMarketingDays("2026-09-10", songCampaignOffsets(fallbackMarketingTimingDefaults).at(-1)), "2026-09-20");
assert.deepEqual(songCampaignOffsets({ ...fallbackMarketingTimingDefaults, songCampaignAdvanceDays: 0 }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
assert.deepEqual(songCampaignOffsets({ ...fallbackMarketingTimingDefaults, songCampaignAdvanceDays: 13 }), [-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0]);
assert.equal(validateMarketingTimingDefaults({ ...fallbackMarketingTimingDefaults, songCampaignAdvanceDays: 14 }), false);
assert.equal(proposedGeneralCampaignEndDate("2026-09-01", 14), "2026-09-14");
assert.equal(proposedGeneralCampaignEndDate("2026-09-01", 5), "2026-09-05");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.match(page, /addUtcDays\(releaseDate, day\.releaseOffset\)/, "Release-date shifts retain each campaign day’s saved offset");
assert.match(page, /useState<"general" \| "song">\("general"\)/, "Add Campaign starts on General Campaign");
console.log("Marketing Defaults V1 timing tests passed.");

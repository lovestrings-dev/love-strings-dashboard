import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fallbackMarketingTimingDefaults, songCampaignOffsets } from "../lib/marketing-defaults.ts";

const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const code = [
  between("function parseCampaignDate(value:", "function formatInputDateForDatabase("),
  between("function applyCampaignDaySeed(", "function createCampaignSlug("),
  between("function getPlaceholderExtraTasks(", "function parseCampaignDate("),
  between("function hasReleaseDayDefaultTasks(", "function calculateCampaignCompletion("),
  between("async function saveMarketingCampaignDays(", "type ProductionSongSaveResult"),
  between("function buildCampaignDays(", "function buildGeneralCampaignDays("),
  between("  async function addCampaign(", "  function updateCampaignReleaseDate(")
].join("\n");
const makeAddCampaign = new Function("context", `with (context) { ${stripTypeScriptTypes(code)}; return addCampaign; }`);

// Exercise the actual optimistic -> server response -> persisted days flow.
for (const serverDate of ["2026-11-20", "2027-01-02", undefined]) {
  for (const timing of [fallbackMarketingTimingDefaults, { songCampaignLengthDays: 21, songCampaignAdvanceDays: 5 }]) {
    let campaigns = [];
    let persisted;
    let savedPayload;
    const addUtcDays = (date, days) => new Date(date.getTime() + days * 86400000);
    const context = {
      productionSongDrafts: [{ id: "song", dbId: "song-db", title: "Test song", releaseDate: "20/11/2026" }],
      campaigns, newMarketingCampaign: {}, marketingTimingDefaults: timing,
      fallbackMarketingTimingDefaults, songCampaignOffsets, addUtcDays,
      defaultCampaignDayCount: 14,
      isRelevantMarketingStatus: (status) => status !== "irrelevant",
      sortCampaignsByReleaseDate: (value) => value,
      setCampaigns: (update) => { campaigns = update(campaigns); },
      setMarketingFocusTarget: () => {},
      createCampaignSlug: () => "saved-campaign",
      formatInputDateForDatabase: () => "2026-11-17",
      fetch: async (url, options) => {
        if (url.endsWith("campaign-days")) {
          savedPayload = JSON.parse(options.body);
          return { ok: true };
        }
        return { ok: true, json: async () => ({ campaign: { id: "campaign-db", slug: "saved-campaign", releaseDate: serverDate, timing } }) };
      }
    };
    await makeAddCampaign(context)({ campaignKind: "song", productionSongId: "song" });
    persisted = { campaign: campaigns[0], days: campaigns[0].campaignDays };
    assert.ok(savedPayload, "creation must persist campaign days");
    assert.equal(savedPayload.campaignId, "campaign-db");
    for (const day of savedPayload.days) {
      assert.ok(day.tasks.length >= 3);
      assert.ok(day.tasks.every((task) => task.status === "not-started"), "all saved tasks must start as not-started, including extra and release-day tasks");
    }
    assert.equal(savedPayload.days.find((day) => day.release_offset === 0).tasks.filter((task) => task.is_standard_task).length, 6);
    const expectedRelease = serverDate ?? "2026-11-20";
    assert.equal(persisted.days.length, timing.songCampaignLengthDays);
    for (const day of persisted.days) {
      assert.equal(day.dateKey, addUtcDays(new Date(`${expectedRelease}T00:00:00Z`), day.releaseOffset).toISOString().slice(0, 10));
    }
    assert.equal(persisted.days.find((day) => day.releaseOffset === 0).dateKey, expectedRelease);
    assert.deepEqual(campaigns[0].campaignDays, persisted.days);
    assert.equal(persisted.campaign.dbId, "campaign-db");
  }
}
console.log("Marketing campaign creation date regression checks passed.");

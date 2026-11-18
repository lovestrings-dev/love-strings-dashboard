import assert from "node:assert/strict";
import { zonedScheduleToUtc, shouldExpireUnstartedPublication } from "../lib/instagram-reel-schedule.ts";

const now = new Date("2026-03-30T12:00:00.000Z");
assert.equal(shouldExpireUnstartedPublication("scheduled", "queued", "2026-03-30T11:00:00.000Z", now, 30), true);
assert.equal(shouldExpireUnstartedPublication("scheduled", "processing_container", "2026-03-30T11:00:00.000Z", now, 30), false, "container reconciliation must survive the lateness cutoff");
assert.equal(shouldExpireUnstartedPublication("publishing", "publishing", "2026-03-30T11:00:00.000Z", now, 30), false);
assert.equal(zonedScheduleToUtc({ date: "2026-03-28", time: "12:00", timezone: "Europe/Vienna", offsetDays: 0 }), "2026-03-28T11:00:00.000Z");
assert.equal(zonedScheduleToUtc({ date: "2026-03-28", time: "12:00", timezone: "Europe/Vienna", offsetDays: 1 }), "2026-03-29T10:00:00.000Z");
assert.throws(() => zonedScheduleToUtc({ date: "2026-03-29", time: "02:30", timezone: "Europe/Vienna", offsetDays: 0 }), /does not exist/);
assert.equal(zonedScheduleToUtc({ date: "2026-10-25", time: "02:30", timezone: "Europe/Vienna", offsetDays: 0 }), "2026-10-25T00:30:00.000Z");
console.log("instagram-reel-publishing behavior checks passed");

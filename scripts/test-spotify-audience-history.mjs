import assert from "node:assert/strict";

const {
  getSpotifyAudienceHistoryStartDate,
  selectSpotifyAudienceHistory
} = await import("../lib/spotify-audience-history.ts");

function row(date, listeners = 0, overrides = {}) {
  return {
    date,
    followers: 0,
    listeners,
    monthlyActiveListeners: 0,
    monthlyListeners: 0,
    playlistAdds: 0,
    saves: 0,
    streams: 0,
    superListeners: 0,
    ...overrides
  };
}

const leadingZeroHistory = [
  row("2024-01-01"),
  row("2024-02-01"),
  row("2026-04-01"),
  row("2026-04-22", 17),
  row("2026-04-30", 19),
  row("2026-05-01", 21),
  row("2026-05-16", 24),
  row("2026-06-01", 0),
  row("2026-06-12", 24)
];

assert.deepEqual(
  selectSpotifyAudienceHistory(leadingZeroHistory).map(({ date, listeners }) => ({ date, listeners })),
  [
    { date: "2026-04-22", listeners: 17 },
    { date: "2026-05-01", listeners: 21 },
    { date: "2026-06-01", listeners: 0 }
  ],
  "Leading zero-only months are discarded, the first non-zero mid-month observation is retained, and later months use their first observation."
);

assert.deepEqual(
  selectSpotifyAudienceHistory([row("2026-04-01"), row("2026-05-01", 17)]).map((item) => item.date),
  ["2026-05-01"],
  "A first meaningful observation on the first of its month starts history there."
);

assert.deepEqual(
  selectSpotifyAudienceHistory(leadingZeroHistory),
  selectSpotifyAudienceHistory([...leadingZeroHistory]),
  "Reprocessing the same lifetime export is deterministic and cannot restore leading zeros."
);

assert.equal(
  getSpotifyAudienceHistoryStartDate([
    { date: "2026-08-01", followers: 12, streams: 1 },
    { date: "2026-07-01", followers: 10, streams: 0 },
    { date: "2026-06-01", followers: 4, streams: 0 },
    { date: "2026-05-01", followers: 3, streams: 0 }
  ]),
  "2026-05-01",
  "A newest-first Supabase result still starts Spotify Evolution at the earliest meaningful month."
);

console.log("Spotify Audience history selection checks passed.");

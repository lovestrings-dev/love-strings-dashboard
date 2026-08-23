export type SpotifyAudienceHistoryRow = {
  date: string;
  followers: number;
  listeners: number;
  monthlyActiveListeners: number;
  monthlyListeners: number;
  playlistAdds: number;
  saves: number;
  streams: number;
  superListeners: number;
};

/**
 * Spotify lifetime exports can include an artificial all-zero period before
 * the artist has meaningful audience data. Keep the first meaningful row even
 * mid-month, then retain the established first-observation-per-month cadence.
 */
export function selectSpotifyAudienceHistory(
  rows: SpotifyAudienceHistoryRow[]
): SpotifyAudienceHistoryRow[] {
  const firstMeaningfulIndex = rows.findIndex(isMeaningfulSpotifyAudienceRow);
  if (firstMeaningfulIndex < 0) return [];

  const meaningfulHistory = rows.slice(firstMeaningfulIndex);
  const byMonth = new Map<string, SpotifyAudienceHistoryRow>();

  for (const row of meaningfulHistory) {
    if (!byMonth.has(row.date.slice(0, 7))) {
      byMonth.set(row.date.slice(0, 7), row);
    }
  }

  return [...byMonth.values()];
}

export function getSpotifyAudienceHistoryStartDate(
  rows: Array<{ date: string; [key: string]: unknown }>
) {
  return rows
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "date" && Number(value) > 0)
    )
    .map((row) => row.date)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))[0];
}

function isMeaningfulSpotifyAudienceRow(row: SpotifyAudienceHistoryRow) {
  return (
    row.followers > 0 ||
    row.listeners > 0 ||
    row.monthlyActiveListeners > 0 ||
    row.monthlyListeners > 0 ||
    row.playlistAdds > 0 ||
    row.saves > 0 ||
    row.streams > 0 ||
    row.superListeners > 0
  );
}

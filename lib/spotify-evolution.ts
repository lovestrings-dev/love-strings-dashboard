import type { EvolutionChart, EvolutionPoint } from "./platform-evolution";

export type SpotifyEvolutionRow = { metric_name: string; metric_value: number | string | null; snapshot_date: string; imported_at: string };
export function spotifyEvolutionCharts(rows: SpotifyEvolutionRow[]): EvolutionChart[] {
  return [
    { metric: "followers", label: "Followers", color: "#1f7a58" },
    { metric: "monthly_active_listeners", label: "Monthly active listeners", color: "#c79522" },
    { metric: "listeners", label: "Listeners", color: "#7c54a8" },
    { metric: "streams", label: "Streams", color: "#2f75a8" }
  ].map(({ metric, label, color }) => {
    const points = new Map<string, EvolutionPoint>();
    // Latest imported observation wins when a source contains duplicate dates.
    for (const row of [...rows].sort((a, b) => a.imported_at.localeCompare(b.imported_at))) {
      if (row.metric_name !== metric || row.metric_value === null || String(row.metric_value).trim() === "") continue;
      const value = Number(row.metric_value);
      if (!Number.isFinite(value)) continue;
      points.set(row.snapshot_date, { date: row.snapshot_date, value });
    }
    return { label, color, points: [...points.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  });
}

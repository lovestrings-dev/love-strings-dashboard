export type EvolutionPoint = { date: string; value: number };
export type EvolutionRange = "30D" | "90D" | "1Y" | "All";
export type EvolutionMode = "absolute" | "growth";
export type EvolutionChart = { label: string; color: string; points: EvolutionPoint[]; comparison?: { label: string; color: string; points: EvolutionPoint[] } };

const dayMs = 86400000;
export function evolutionInterval(charts: EvolutionChart[], range: EvolutionRange, today: string) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const dates = charts.flatMap((chart) => [...chart.points, ...(chart.comparison?.points ?? [])].map((point) => point.date)).filter((date) => date <= today).sort();
  let start = end;
  if (range === "All") start = dates.length ? Date.parse(`${dates[0]}T00:00:00Z`) : end;
  else if (range === "1Y") {
    const date = new Date(end);
    // Calendar year, clamping leap day to the last day of February.
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
    start = date.getTime();
  } else start = end - (Number.parseInt(range) - 1) * dayMs;
  return { start: new Date(start).toISOString().slice(0, 10), end: today };
}

export function evolutionSeries(points: EvolutionPoint[], start: string, end: string, mode: EvolutionMode) {
  const available = points.filter((point) => point.date <= end && Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date));
  const observations = available.filter((point) => point.date >= start);
  const baseline = observations[0];
  const previousByDate = new Map(available.map((point, index) => [point.date, index > 0 ? point.value - available[index - 1].value : null]));
  return observations.map((point) => ({
    ...point,
    plottedValue: mode === "growth" ? point.value - baseline.value : point.value,
    previousChange: previousByDate.get(point.date) ?? null
  }));
}

export function evolutionDomain(values: number[]) {
  let min = Infinity, max = -Infinity;
  for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
  if (!values.length) return { min: 0, max: 1 };
  const padding = Math.max((max - min) * 0.12, 1);
  return { min: min >= 0 ? Math.max(0, min - padding) : min - padding, max: max + padding };
}

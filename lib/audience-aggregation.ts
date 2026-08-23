export const audienceEstimationAssumptions = {
  facebookFollowersContribution: 0.5,
  instagramThreadsSmallerContribution: 0.1,
  youtubeFamilySmallerContribution: 0.5
} as const;

export type AudienceMetricRow = {
  importedAt?: string;
  metricName: string;
  metricValue: number | string;
  notes?: string | null;
  platformSlug: string;
  snapshotDate: string;
  source?: string | null;
};

type MetricContribution = {
  key: string;
  metricName: string;
  platformSlug: string;
  snapshotDate: string;
  source: string | null;
  title?: string;
  value: number;
};

export type AudienceEstimate = {
  lower: number;
  lowerDelta?: number;
  maximum: number;
  maximumDelta?: number;
  sourceMetrics: string[];
};

export type CurrentReleaseAggregate = {
  delta?: number;
  includedPlatforms: string[];
  title: string;
  value: number;
};

export type CatalogueAggregate = {
  delta?: number;
  includedPlatforms: string[];
  value: number;
};

export type AudienceDashboardCalculations = {
  catalogue: CatalogueAggregate | null;
  currentRelease: CurrentReleaseAggregate | null;
  estimatedAudience: AudienceEstimate | null;
};

export type AudienceEvolutionHistory = {
  catalogue: Array<{ date: string; value: number }>;
  currentRelease: Array<{ date: string; value: number }>;
  currentReleaseTitle: string | null;
  estimatedAudience: Array<{ date: string; lower: number; maximum: number }>;
};

/**
 * Product estimates, not measured unique people. Source metrics stay
 * authoritative; this layer only derives dashboard interpretation from them.
 */
export function calculateAudienceDashboard(
  rows: AudienceMetricRow[]
): AudienceDashboardCalculations {
  return calculateAudienceDashboardAtDate(rows);
}

export function calculateAudienceDashboardAtDate(
  rows: AudienceMetricRow[],
  targetDate?: string
): AudienceDashboardCalculations {
  return {
    catalogue: calculateCatalogue(rows, targetDate),
    currentRelease: calculateCurrentRelease(rows, targetDate),
    estimatedAudience: calculateEstimatedAudience(rows, targetDate)
  };
}

/**
 * Reconstructs graph points from authoritative provider snapshots. These are
 * deliberately not persisted aggregate rows: each calendar day in the raw
 * provider-history range is reconstructed by resolving every source <= that day.
 */
export function calculateAudienceEvolutionHistory(rows: AudienceMetricRow[]): AudienceEvolutionHistory {
  const currentReleaseTitle = calculateCurrentRelease(rows)?.title ?? null;
  const currentReleaseKey = currentReleaseTitle ? normalizeReleaseTitle(currentReleaseTitle) : null;
  const snapshotDates = [...new Set(rows.map((row) => row.snapshotDate).filter(isValidDate))].sort();
  const dates = calendarDatesInclusive(snapshotDates[0], snapshotDates.at(-1));
  const history: AudienceEvolutionHistory = {
    catalogue: [],
    currentRelease: [],
    currentReleaseTitle,
    estimatedAudience: []
  };

  dates.forEach((date) => {
    const calculation = calculateAudienceDashboardAtDate(rows, date);
    if (calculation.estimatedAudience) {
      history.estimatedAudience.push({
        date,
        lower: calculation.estimatedAudience.lower,
        maximum: calculation.estimatedAudience.maximum
      });
    }
    if (calculation.catalogue) {
      history.catalogue.push({ date, value: calculation.catalogue.value });
    }
    if (
      calculation.currentRelease &&
      currentReleaseKey &&
      normalizeReleaseTitle(calculation.currentRelease.title) === currentReleaseKey
    ) {
      history.currentRelease.push({ date, value: calculation.currentRelease.value });
    }
  });

  return history;
}

export function normalizeReleaseTitle(title: string) {
  return title.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function calculateEstimatedAudience(rows: AudienceMetricRow[], targetDate?: string): AudienceEstimate | null {
  const inputs = getAudienceInputs(rows, targetDate);
  const current = estimateAudience(inputs);
  if (!current) return null;

  const currentContributions = Object.values(inputs).filter(
    (value): value is MetricContribution => Boolean(value)
  );
  const comparisonDate = targetDate ?? latestDate(currentContributions);
  const previousInputs = comparisonDate
    ? getAudienceInputs(rows, previousCalendarDate(comparisonDate))
    : null;
  const previous =
    comparisonDate &&
    hasSameInputKeys(inputs, previousInputs)
      ? estimateAudience(previousInputs!)
      : null;

  return {
    ...current,
    ...(previous
      ? {
          lowerDelta: current.lower - previous.lower,
          maximumDelta: current.maximum - previous.maximum
        }
      : {})
  };
}

function getAudienceInputs(rows: AudienceMetricRow[], date?: string) {
  const canonicalInstagram =
    findMetric(rows, "instagram", "followers", "instagram-api", date) ??
    findMetric(rows, "instagram", "followers", "instagram-login-api", date);

  return {
    facebook: findMetric(rows, "facebook", "followers", undefined, date),
    instagram: canonicalInstagram,
    spotify: findMetric(rows, "spotify", "followers", "spotify-audience-current-csv", date),
    threads: findMetric(rows, "threads", "followers", "threads-api", date),
    website: findMetric(rows, "google-analytics", "active_users_30d", undefined, date),
    youtubeChannel: findMetric(rows, "youtube", "subscribers", undefined, date),
    youtubeTopic: findMetric(rows, "youtube-music", "subscribers", "youtube-data-api", date)
  };
}

function estimateAudience(inputs: ReturnType<typeof getAudienceInputs>): Omit<AudienceEstimate, "lowerDelta" | "maximumDelta"> | null {
  const values = Object.values(inputs).filter(
    (value): value is MetricContribution => Boolean(value)
  );
  if (values.length === 0) return null;

  const instagramThreads = overlapAdjustedPair(
    inputs.instagram?.value,
    inputs.threads?.value,
    audienceEstimationAssumptions.instagramThreadsSmallerContribution
  );
  const youtubeFamily = overlapAdjustedPair(
    inputs.youtubeChannel?.value,
    inputs.youtubeTopic?.value,
    audienceEstimationAssumptions.youtubeFamilySmallerContribution
  );
  const lower =
    instagramThreads +
    (inputs.facebook?.value ?? 0) * audienceEstimationAssumptions.facebookFollowersContribution +
    youtubeFamily +
    (inputs.spotify?.value ?? 0);
  const maximum = values.reduce((sum, contribution) => sum + contribution.value, 0);

  return {
    lower,
    maximum,
    sourceMetrics: values.map((value) => `${value.platformSlug}:${value.metricName}:${value.source ?? "any"}`)
  };
}

function calculateCurrentRelease(rows: AudienceMetricRow[], targetDate?: string): CurrentReleaseAggregate | null {
  const spotifyTitle = findMetric(rows, "spotify", "latest_release_name", "spotify-songs-csv", targetDate)?.title;
  const appleTitle = findMetric(rows, "apple-music", "current_release_name", "apple-music-csv", targetDate)?.title;
  const youtubeTitle = findMetric(rows, "youtube-music", "current_release_name", "youtube-data-api", targetDate)?.title ??
    findMetric(rows, "youtube-music", "current_release_plays", "youtube-data-api", targetDate)?.title;
  const canonicalTitle = spotifyTitle ?? appleTitle ?? youtubeTitle;
  if (!canonicalTitle) return null;

  const contributions = [
    findMetricWithMatchingTitle(rows, "youtube-music", "current_release_plays", "youtube-data-api", canonicalTitle, targetDate),
    findMetricWithMatchingTitle(rows, "spotify", "latest_release_streams", "spotify-songs-csv", canonicalTitle, targetDate),
    findMetricWithMatchingTitle(rows, "apple-music", "current_release_plays", "apple-music-csv", canonicalTitle, targetDate)
  ].filter((value): value is MetricContribution => Boolean(value));
  if (contributions.length === 0) return null;

  const value = contributions.reduce((sum, contribution) => sum + contribution.value, 0);
  return {
    includedPlatforms: contributions.map((contribution) => contribution.platformSlug),
    title: canonicalTitle,
    value,
    ...getComparableDelta(rows, contributions, (previous) =>
      previous.every((contribution) =>
        normalizeReleaseTitle(contribution.title ?? "") === normalizeReleaseTitle(canonicalTitle)
      )
        ? previous.reduce((sum, contribution) => sum + contribution.value, 0)
        : null
    )
  };
}

function calculateCatalogue(rows: AudienceMetricRow[], targetDate?: string): CatalogueAggregate | null {
  const contributions = [
    findMetric(rows, "youtube-music", "total_plays", "youtube-data-api", targetDate),
    findMetric(rows, "apple-music", "total_plays", "apple-music-csv", targetDate),
    findMetric(rows, "spotify", "total_catalog_streams", "spotify-songs-csv", targetDate)
  ].filter((value): value is MetricContribution => Boolean(value));
  if (contributions.length === 0) return null;

  const value = contributions.reduce((sum, contribution) => sum + contribution.value, 0);
  return {
    includedPlatforms: contributions.map((contribution) => contribution.platformSlug),
    value,
    ...getComparableDelta(rows, contributions, (previous) =>
      previous.reduce((sum, contribution) => sum + contribution.value, 0)
    )
  };
}

function getComparableDelta(
  rows: AudienceMetricRow[],
  current: MetricContribution[],
  getPreviousValue: (previous: MetricContribution[]) => number | null
) {
  const comparisonDate = latestDate(current);
  if (!comparisonDate) return {};
  const previousDate = previousCalendarDate(comparisonDate);
  const previous = current.map((contribution) =>
    findMetric(
      rows,
      contribution.platformSlug,
      contribution.metricName,
      contribution.source ?? undefined,
      previousDate
    )
  );
  if (previous.some((contribution) => !contribution)) return {};
  const previousValue = getPreviousValue(previous as MetricContribution[]);
  if (previousValue === null) return {};
  return { delta: current.reduce((sum, contribution) => sum + contribution.value, 0) - previousValue };
}

function findMetricWithMatchingTitle(
  rows: AudienceMetricRow[],
  platformSlug: string,
  metricName: string,
  source: string,
  title: string,
  targetDate?: string
) {
  const contribution = findMetric(rows, platformSlug, metricName, source, targetDate);
  return contribution && normalizeReleaseTitle(contribution.title ?? "") === normalizeReleaseTitle(title)
    ? contribution
    : null;
}

function findMetric(
  rows: AudienceMetricRow[],
  platformSlug: string,
  metricName: string,
  source?: string,
  targetDate?: string
): MetricContribution | null {
  const row = rows
    .filter((row) =>
      row.platformSlug === platformSlug &&
      row.metricName === metricName &&
      (source === undefined || row.source === source) &&
      (targetDate === undefined || row.snapshotDate <= targetDate) &&
      Number.isFinite(Number(row.metricValue))
    )
    .sort(compareRows)[0];
  return row ? toContribution(row) : null;
}

function toContribution(row: AudienceMetricRow): MetricContribution {
  return {
    key: `${row.platformSlug}:${row.metricName}:${row.source ?? "any"}`,
    metricName: row.metricName,
    platformSlug: row.platformSlug,
    snapshotDate: row.snapshotDate,
    source: row.source ?? null,
    title: row.notes ?? undefined,
    value: Number(row.metricValue)
  };
}

function compareRows(first: AudienceMetricRow, second: AudienceMetricRow) {
  const snapshotDifference = Date.parse(second.snapshotDate) - Date.parse(first.snapshotDate);
  if (snapshotDifference !== 0) return snapshotDifference;
  return Date.parse(second.importedAt ?? "") - Date.parse(first.importedAt ?? "");
}

function hasSameInputKeys(
  current: ReturnType<typeof getAudienceInputs>,
  previous: ReturnType<typeof getAudienceInputs> | null
) {
  if (!previous) return false;
  return Object.entries(current).every(([key, currentValue]) =>
    !currentValue || previous[key as keyof typeof previous]?.key === currentValue.key
  );
}

function overlapAdjustedPair(first: number | undefined, second: number | undefined, smallerCoefficient: number) {
  if (first === undefined) return second ?? 0;
  if (second === undefined) return first;
  return Math.max(first, second) + Math.min(first, second) * smallerCoefficient;
}

function latestDate(contributions: MetricContribution[]) {
  return contributions.map((contribution) => contribution.snapshotDate).sort().at(-1) ?? null;
}

function previousCalendarDate(date: string) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return "";
  return new Date(timestamp - 86_400_000).toISOString().slice(0, 10);
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

function calendarDatesInclusive(firstDate?: string, lastDate?: string) {
  if (!firstDate || !lastDate) return [];
  const start = Date.parse(`${firstDate}T00:00:00Z`);
  const end = Date.parse(`${lastDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];

  const dates: string[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

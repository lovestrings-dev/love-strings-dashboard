export type MetricCollectorName =
  | "google-analytics"
  | "instagram"
  | "spotify"
  | "youtube"
  | "youtube-music";

export function getWorkspaceEnabledCollectors({
  analyticsConfigured,
  instagramConfigured,
  isLegacyWorkspace,
  youtubeConfigured,
  youtubeTopicConfigured
}: {
  analyticsConfigured: boolean;
  instagramConfigured: boolean;
  isLegacyWorkspace: boolean;
  youtubeConfigured: boolean;
  youtubeTopicConfigured: boolean;
}): Set<MetricCollectorName> {
  // The remaining legacy collectors still rely on Love Strings-only global
  // credentials. YouTube is deliberately excluded: every workspace, including
  // Love Strings, must have its own stored channel configuration.
  const enabledCollectors = isLegacyWorkspace
    ? new Set<MetricCollectorName>(["google-analytics", "spotify"])
    : new Set<MetricCollectorName>();

  if (analyticsConfigured) enabledCollectors.add("google-analytics");
  if (instagramConfigured) enabledCollectors.add("instagram");
  if (youtubeConfigured) enabledCollectors.add("youtube");
  if (youtubeTopicConfigured) enabledCollectors.add("youtube-music");
  return enabledCollectors;
}

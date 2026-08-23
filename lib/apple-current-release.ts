export type AppleReleaseCandidate = {
  title: string;
  date?: string | null;
};

export type AppleCurrentReleaseResolution = {
  strategy: "spotify-topic-match" | "youtube-topic-newer" | "spotify-release" | "fallback";
  title: string;
};

/**
 * Apple reports do not provide release dates. This deliberately uses release
 * evidence from other platform sources only when that title is in the Apple
 * report; report period and import timestamps are never release evidence.
 */
export function resolveAppleCurrentRelease({
  appleSongs,
  fallbackTitle,
  spotify,
  youtubeTopic
}: {
  appleSongs: string[];
  fallbackTitle?: string | null;
  spotify?: AppleReleaseCandidate | null;
  youtubeTopic?: AppleReleaseCandidate | null;
}): AppleCurrentReleaseResolution {
  const appleSongsByNormalizedTitle = new Map(
    appleSongs.map((title) => [normalizeReleaseTitle(title), title])
  );
  const spotifyTitle = getAppleTitle(spotify?.title, appleSongsByNormalizedTitle);
  const youtubeTopicTitle = getAppleTitle(
    youtubeTopic?.title,
    appleSongsByNormalizedTitle
  );

  if (
    spotifyTitle &&
    youtubeTopicTitle &&
    normalizeReleaseTitle(spotifyTitle) === normalizeReleaseTitle(youtubeTopicTitle)
  ) {
    return { strategy: "spotify-topic-match", title: spotifyTitle };
  }

  if (
    youtubeTopicTitle &&
    isDateAfter(youtubeTopic?.date, spotify?.date)
  ) {
    return { strategy: "youtube-topic-newer", title: youtubeTopicTitle };
  }

  if (spotifyTitle) {
    return { strategy: "spotify-release", title: spotifyTitle };
  }

  const fallback = getAppleTitle(fallbackTitle, appleSongsByNormalizedTitle);
  return { strategy: "fallback", title: fallback ?? appleSongs[0] ?? "" };
}

export function normalizeReleaseTitle(title: string) {
  return title
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getAppleTitle(
  title: string | null | undefined,
  appleSongsByNormalizedTitle: Map<string, string>
) {
  if (!title) return null;
  return appleSongsByNormalizedTitle.get(normalizeReleaseTitle(title)) ?? null;
}

function isDateAfter(
  candidateDate: string | null | undefined,
  baselineDate: string | null | undefined
) {
  if (!isIsoDate(candidateDate)) return false;
  return !isIsoDate(baselineDate) || candidateDate > baselineDate;
}

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

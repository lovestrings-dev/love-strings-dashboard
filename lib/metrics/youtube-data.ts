type YouTubeChannel = {
  id: string;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type YouTubeTrack = {
  id: string;
  snippet?: { title?: string; publishedAt?: string; channelId?: string };
  statistics?: { viewCount?: string };
};

export class YouTubeDataError extends Error {
  readonly status: number;
  readonly reason: string | null;

  constructor(status: number, reason: string | null) {
    const message = reason === "playlistNotFound"
      ? "The channel's uploads playlist is unavailable."
      : status === 429 || reason === "quotaExceeded" || reason === "dailyLimitExceeded"
        ? "YouTube's request limit was reached. Please try again later."
        : status === 401 || status === 403
          ? "YouTube API access was denied. Check the API key and its permissions."
          : "YouTube could not provide statistics. Please try again later.";
    super(message);
    this.name = "YouTubeDataError";
    this.status = status;
    this.reason = reason;
  }
}

export async function fetchYouTubeJson(apiKey: string, resource: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // Fetch errors may contain the request URL, including its API key.
    throw new Error("YouTube could not be reached. Please try again later.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const reason = payload?.error?.errors?.[0]?.reason;
    throw new YouTubeDataError(response.status, typeof reason === "string" ? reason : null);
  }
  return response.json();
}

export async function discoverYouTubeMusicTracks(apiKey: string, channel: YouTubeChannel): Promise<YouTubeTrack[]> {
  const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
  let trackIds: string[];
  if (playlistId) {
    try {
      const playlist = await fetchYouTubeJson(apiKey, "playlistItems", {
        maxResults: "25", part: "snippet,contentDetails", playlistId
      });
      trackIds = (playlist.items ?? []).map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId).filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
    } catch (error) {
      // Topic channels can advertise uploads playlists which Google cannot list.
      // Never spend search quota to retry a credential/quota/transient failure.
      if (!(error instanceof YouTubeDataError) || error.status !== 404 || error.reason !== "playlistNotFound") throw error;
      trackIds = await searchTopicTrackIds(apiKey, channel.id);
    }
  } else {
    trackIds = await searchTopicTrackIds(apiKey, channel.id);
  }
  if (!trackIds.length) return [];
  const videos = await fetchYouTubeJson(apiKey, "videos", {
    id: [...new Set(trackIds)].join(","), part: "id,snippet,statistics"
  });
  // Preserve workspace/channel isolation even if a provider result is unexpected.
  return ((videos.items ?? []) as YouTubeTrack[])
    .filter((item) => item.snippet?.channelId === channel.id)
    .sort((first, second) => Date.parse(second.snippet?.publishedAt ?? "") - Date.parse(first.snippet?.publishedAt ?? ""));
}

async function searchTopicTrackIds(apiKey: string, channelId: string): Promise<string[]> {
  const result = await fetchYouTubeJson(apiKey, "search", {
    channelId, part: "snippet", type: "video", order: "date", maxResults: "25"
  });
  return (result.items ?? [])
    .filter((item: { snippet?: { channelId?: string } }) => item.snippet?.channelId === channelId)
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
}

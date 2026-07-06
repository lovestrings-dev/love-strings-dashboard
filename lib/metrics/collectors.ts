import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CollectorStatus = "fulfilled" | "rejected" | "skipped";

type MetricCollectorResult = {
  metrics?: Record<string, number | string | null>;
  name: "instagram" | "youtube" | "youtube-music";
  reason?: string;
  status: CollectorStatus;
};

type MetricSnapshotInput = {
  contentExternalId?: string | null;
  contentTitle?: string | null;
  contentType?: string | null;
  contentUrl?: string | null;
  metricName: string;
  metricUnit: string;
  metricValue: number;
  notes?: string | null;
};

type PlatformAccountInput = {
  accountName: string;
  category: string;
  externalId: string;
  platformName: string;
  platformSlug: string;
  url: string;
};
type YouTubeVideoItem = {
  id: string;
  snippet?: {
    publishedAt?: string;
    title?: string;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function refreshAllMetricCollectors() {
  const startedAt = new Date().toISOString();
  const collectors: Array<{
    name: MetricCollectorResult["name"];
    refresh: () => Promise<MetricCollectorResult>;
  }> = [
    { name: "youtube", refresh: refreshYouTubeMetrics },
    { name: "instagram", refresh: refreshInstagramMetrics },
    { name: "youtube-music", refresh: refreshYouTubeMusicMetrics }
  ];
  const results = await Promise.allSettled(collectors.map((collector) => collector.refresh()));

  return {
    finishedAt: new Date().toISOString(),
    results: results.map((result, index): MetricCollectorResult => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      return {
        name: collectors[index].name,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        status: "rejected"
      };
    }),
    startedAt
  };
}

async function refreshYouTubeMusicMetrics(): Promise<MetricCollectorResult> {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const youtubeMusicChannelId =
    process.env.YOUTUBE_MUSIC_CHANNEL_ID ?? "UCKlfg9lYKyMOg_Oiz-Zb1Fg";

  if (!youtubeApiKey) {
    return { name: "youtube-music", reason: "Missing YOUTUBE_API_KEY.", status: "skipped" };
  }

  const channel = await fetchYouTubeJson(youtubeApiKey, "channels", {
    id: youtubeMusicChannelId,
    part: "id,snippet,statistics,contentDetails"
  });
  const channelItem = channel.items?.[0];

  if (!channelItem) {
    throw new Error(`No YouTube Music channel found for id ${youtubeMusicChannelId}.`);
  }

  const tracks = await discoverYouTubeMusicTracks(youtubeApiKey, channelItem);
  const currentRelease = tracks[0] ?? null;

  await upsertPlatformMetricSnapshots(
    {
      accountName: cleanAsciiTitle(channelItem.snippet?.title ?? "Love Strings - Topic"),
      category: "music",
      externalId: channelItem.id,
      platformName: "YouTube Music",
      platformSlug: "youtube-music",
      url: `https://music.youtube.com/channel/${channelItem.id}`
    },
    [
      {
        metricName: "subscribers",
        metricUnit: "count",
        metricValue: Number(channelItem.statistics?.subscriberCount ?? 0)
      },
      {
        metricName: "total_plays",
        metricUnit: "plays",
        metricValue: Number(channelItem.statistics?.viewCount ?? 0)
      },
      ...(currentRelease
        ? [
            {
              contentExternalId: currentRelease.id,
              contentTitle: cleanAsciiTitle(currentRelease.snippet?.title ?? "Current release"),
              contentType: "track",
              contentUrl: `https://music.youtube.com/watch?v=${currentRelease.id}`,
              metricName: "current_release_plays",
              metricUnit: "plays",
              metricValue: Number(currentRelease.statistics?.viewCount ?? 0),
              notes: cleanAsciiTitle(currentRelease.snippet?.title ?? "Current release")
            }
          ]
        : [])
    ],
    "youtube-data-api"
  );

  return {
    metrics: {
      currentReleasePlays: Number(currentRelease?.statistics?.viewCount ?? 0),
      currentReleaseTitle: currentRelease?.snippet?.title ?? null,
      subscribers: Number(channelItem.statistics?.subscriberCount ?? 0),
      totalPlays: Number(channelItem.statistics?.viewCount ?? 0)
    },
    name: "youtube-music",
    status: "fulfilled"
  };
}

async function refreshYouTubeMetrics(): Promise<MetricCollectorResult> {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeApiKey) {
    return { name: "youtube", reason: "Missing YOUTUBE_API_KEY.", status: "skipped" };
  }

  const channelHandle = process.env.YOUTUBE_CHANNEL_HANDLE ?? "@LoveStringsBand";
  const maxUploadsToInspect = Number(process.env.YOUTUBE_UPLOADS_TO_INSPECT ?? 25);
  const maxShortDurationSeconds = Number(process.env.YOUTUBE_SHORT_MAX_SECONDS ?? 180);

  const channel = await fetchYouTubeJson(youtubeApiKey, "channels", {
    forHandle: channelHandle,
    part: "id,snippet,statistics,contentDetails"
  });
  const channelItem = channel.items?.[0];

  if (!channelItem) {
    throw new Error(`No YouTube channel found for handle ${channelHandle}.`);
  }

  const uploads = await discoverLatestYouTubeUploads(
    youtubeApiKey,
    channelItem,
    maxUploadsToInspect,
    maxShortDurationSeconds
  );

  if (!uploads.latestVideo || !uploads.latestShort) {
    throw new Error("Could not discover both latest YouTube video and latest Short.");
  }

  const videos = await fetchYouTubeJson(youtubeApiKey, "videos", {
    id: `${uploads.latestVideo.id},${uploads.latestShort.id}`,
    part: "id,snippet,statistics"
  });
  const videoItems = (videos.items ?? []) as YouTubeVideoItem[];
  const videoById = new Map(videoItems.map((item) => [item.id, item]));
  const latestVideo = videoById.get(uploads.latestVideo.id);
  const latestShort = videoById.get(uploads.latestShort.id);

  if (!latestVideo || !latestShort) {
    throw new Error("Could not fetch latest YouTube content statistics.");
  }

  await upsertPlatformMetricSnapshots(
    {
      accountName: "Love Strings YouTube Channel",
      category: "video",
      externalId: channelItem.id,
      platformName: "YouTube",
      platformSlug: "youtube",
      url: "https://www.youtube.com/@LoveStringsBand"
    },
    [
      {
        metricName: "subscribers",
        metricUnit: "count",
        metricValue: Number(channelItem.statistics?.subscriberCount ?? 0)
      },
      {
        contentExternalId: latestVideo.id,
        contentTitle: cleanAsciiTitle(latestVideo.snippet?.title ?? "Latest video"),
        contentType: "video",
        contentUrl: `https://youtu.be/${latestVideo.id}`,
        metricName: "latest_video_views",
        metricUnit: "views",
        metricValue: Number(latestVideo.statistics?.viewCount ?? 0),
        notes: cleanAsciiTitle(latestVideo.snippet?.title ?? "Latest video")
      },
      {
        contentExternalId: latestShort.id,
        contentTitle: cleanAsciiTitle(latestShort.snippet?.title ?? "Latest short"),
        contentType: "short",
        contentUrl: `https://youtube.com/shorts/${latestShort.id}`,
        metricName: "latest_short_views",
        metricUnit: "views",
        metricValue: Number(latestShort.statistics?.viewCount ?? 0),
        notes: cleanAsciiTitle(latestShort.snippet?.title ?? "Latest short")
      }
    ],
    "youtube-data-api"
  );

  return {
    metrics: {
      latestShortViews: Number(latestShort.statistics?.viewCount ?? 0),
      latestVideoViews: Number(latestVideo.statistics?.viewCount ?? 0),
      subscribers: Number(channelItem.statistics?.subscriberCount ?? 0)
    },
    name: "youtube",
    status: "fulfilled"
  };
}

async function refreshInstagramMetrics(): Promise<MetricCollectorResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    return {
      name: "instagram",
      reason: "Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID.",
      status: "skipped"
    };
  }

  const account = await fetchInstagramJson(accessToken, accountId, {
    fields: "id,username,name,followers_count,follows_count,media_count"
  });
  const media = await fetchInstagramJson(accessToken, `${accountId}/media`, {
    fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
    limit: "10"
  });
  const latestMedia = getLatestInstagramMedia(media.data ?? []);
  const [reach30d, views30d, latestMediaInsights] = await Promise.all([
    fetchInstagramAccountInsight30d(accessToken, accountId, "reach"),
    fetchInstagramAccountInsight30d(accessToken, accountId, "views"),
    latestMedia
      ? fetchFirstAvailableInstagramMediaInsights(accessToken, latestMedia.id, [
          ["views", "reach"],
          ["plays", "reach"],
          ["impressions", "reach"]
        ])
      : Promise.resolve({})
  ]);
  const latestMediaTitle = latestMedia ? cleanTitle(getInstagramMediaTitle(latestMedia)) : null;

  await upsertPlatformMetricSnapshots(
    {
      accountName: "Love Strings Instagram",
      category: "social",
      externalId: account.id,
      platformName: "Instagram",
      platformSlug: "instagram",
      url: `https://www.instagram.com/${account.username ?? "lovestringsband"}/`
    },
    [
      {
        metricName: "followers",
        metricUnit: "count",
        metricValue: Number(account.followers_count ?? 0)
      },
      {
        metricName: "accounts_reached_30d",
        metricUnit: "count",
        metricValue: Number(reach30d ?? 0)
      },
      {
        metricName: "views_30d",
        metricUnit: "views",
        metricValue: Number(views30d ?? 0)
      },
      ...(latestMedia
        ? [
            {
              contentExternalId: latestMedia.id,
              contentTitle: latestMediaTitle,
              contentType: latestMedia.media_product_type === "REELS" ? "reel" : "post",
              contentUrl: latestMedia.permalink ?? null,
              metricName: "latest_reel_post_views",
              metricUnit: "views",
              metricValue: Number(latestMediaInsights.views ?? latestMediaInsights.plays ?? 0),
              notes: latestMediaTitle
            }
          ]
        : [])
    ],
    "instagram-api"
  );

  return {
    metrics: {
      accountsReached30d: Number(reach30d ?? 0),
      followers: Number(account.followers_count ?? 0),
      latestMediaViews: Number(latestMediaInsights.views ?? latestMediaInsights.plays ?? 0),
      views30d: Number(views30d ?? 0)
    },
    name: "instagram",
    status: "fulfilled"
  };
}

async function upsertPlatformMetricSnapshots(
  accountInput: PlatformAccountInput,
  snapshots: MetricSnapshotInput[],
  source: string
) {
  const supabase = createServiceSupabaseClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const { data: platform, error: platformError } = await supabase
    .from("platforms")
    .upsert(
      {
        category: accountInput.category,
        name: accountInput.platformName,
        slug: accountInput.platformSlug
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (platformError) throw platformError;

  const { data: account, error: accountError } = await supabase
    .from("platform_accounts")
    .upsert(
      {
        account_name: accountInput.accountName,
        external_id: accountInput.externalId,
        platform_id: platform.id,
        url: accountInput.url
      },
      { onConflict: "platform_id,account_name" }
    )
    .select("id")
    .single();

  if (accountError) throw accountError;

  for (const snapshot of snapshots) {
    const contentPostId = snapshot.contentExternalId
      ? await upsertContentPost(supabase, account.id, snapshot)
      : null;

    const { error } = await supabase
      .from("platform_metric_snapshots")
      .upsert(
        {
          content_post_id: contentPostId,
          metric_name: snapshot.metricName,
          metric_unit: snapshot.metricUnit,
          metric_value: snapshot.metricValue,
          notes: snapshot.notes ?? null,
          platform_account_id: account.id,
          platform_id: platform.id,
          snapshot_date: snapshotDate,
          source
        },
        {
          onConflict:
            "snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source"
        }
      );

    if (error) throw error;
  }
}

async function upsertContentPost(
  supabase: SupabaseClient,
  platformAccountId: string,
  snapshot: MetricSnapshotInput
) {
  const { data, error } = await supabase
    .from("content_posts")
    .upsert(
      {
        content_type: snapshot.contentType ?? "post",
        external_id: snapshot.contentExternalId,
        platform_account_id: platformAccountId,
        title: snapshot.contentTitle,
        url: snapshot.contentUrl
      },
      { onConflict: "platform_account_id,external_id" }
    )
    .select("id")
    .single();

  if (error) throw error;

  return data.id;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

async function fetchYouTubeJson(
  apiKey: string,
  resource: string,
  params: Record<string, string>
) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`YouTube API request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function discoverLatestYouTubeUploads(
  apiKey: string,
  channelItem: any,
  uploadLimit: number,
  maxShortDurationSeconds: number
) {
  const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    return { latestShort: null, latestVideo: null };
  }

  const playlist = await fetchYouTubeJson(apiKey, "playlistItems", {
    maxResults: String(Math.max(1, Math.min(uploadLimit, 50))),
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId
  });
  const uploadIds =
    playlist.items?.map((item: any) => item.contentDetails?.videoId).filter(Boolean) ?? [];
  const videos = await fetchYouTubeJson(apiKey, "videos", {
    id: uploadIds.join(","),
    part: "id,snippet,contentDetails"
  });
  const uploads =
    videos.items
      ?.map((item: any) => ({
        durationSeconds: parseYouTubeDurationSeconds(item.contentDetails?.duration ?? "PT0S"),
        id: item.id,
        publishedAt: item.snippet?.publishedAt ?? ""
      }))
      .sort(
        (first: { publishedAt: string }, second: { publishedAt: string }) =>
          new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime()
      ) ?? [];

  return {
    latestShort:
      uploads.find(
        (upload: { durationSeconds: number }) =>
          upload.durationSeconds > 0 && upload.durationSeconds <= maxShortDurationSeconds
      ) ?? null,
    latestVideo:
      uploads.find(
        (upload: { durationSeconds: number }) => upload.durationSeconds > maxShortDurationSeconds
      ) ?? null
  };
}

async function discoverYouTubeMusicTracks(apiKey: string, channelItem: any) {
  const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    return [];
  }

  const playlist = await fetchYouTubeJson(apiKey, "playlistItems", {
    maxResults: "25",
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId
  });
  const trackIds =
    playlist.items?.map((item: any) => item.contentDetails?.videoId).filter(Boolean) ?? [];

  if (trackIds.length === 0) {
    return [];
  }

  const videos = await fetchYouTubeJson(apiKey, "videos", {
    id: trackIds.join(","),
    part: "id,snippet,statistics"
  });

  return ((videos.items ?? []) as YouTubeVideoItem[]).sort(
    (first, second) =>
      Date.parse(second.snippet?.publishedAt ?? "") - Date.parse(first.snippet?.publishedAt ?? "")
  );
}

function parseYouTubeDurationSeconds(duration: string) {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);

  if (!match) {
    return 0;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

async function fetchInstagramJson(
  accessToken: string,
  path: string,
  params: Record<string, string>
) {
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";
  const url = new URL(`https://graph.instagram.com/${version}/${path}`);
  url.searchParams.set("access_token", accessToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Instagram API request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchInstagramAccountInsight30d(
  accessToken: string,
  accountId: string,
  metricName: string
) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 60 * 60;
  const response = await fetchInstagramJson(accessToken, `${accountId}/insights`, {
    metric: metricName,
    metric_type: "total_value",
    period: "day",
    since: String(since),
    until: String(until)
  });

  return getInsightResponseValue(response.data ?? []);
}

async function fetchFirstAvailableInstagramMediaInsights(
  accessToken: string,
  mediaId: string,
  metricSets: string[][]
) {
  for (const metricNames of metricSets) {
    try {
      const response = await fetchInstagramJson(accessToken, `${mediaId}/insights`, {
        metric: metricNames.join(",")
      });

      return mapInsightValues(response.data ?? []);
    } catch (error) {
      if (!String(error).includes("Instagram API request failed")) {
        throw error;
      }
    }
  }

  return {};
}

function getInsightResponseValue(insights: any[]) {
  const firstInsight = insights[0];

  if (!firstInsight) {
    return null;
  }

  if (firstInsight.total_value?.value !== undefined) {
    return Number(firstInsight.total_value.value);
  }

  if (Array.isArray(firstInsight.values)) {
    return firstInsight.values.reduce(
      (total: number, item: { value?: number }) => total + Number(item.value ?? 0),
      0
    );
  }

  return null;
}

function mapInsightValues(insights: any[]) {
  return Object.fromEntries(
    insights.map((insight) => [
      insight.name,
      Number(insight.values?.[0]?.value ?? 0)
    ])
  );
}

function getLatestInstagramMedia(mediaItems: any[]) {
  return (
    mediaItems
      .slice()
      .sort(
        (first, second) =>
          new Date(second.timestamp ?? 0).getTime() -
          new Date(first.timestamp ?? 0).getTime()
      )[0] ?? null
  );
}

function getInstagramMediaTitle(media: any) {
  const caption = media.caption?.split(/\r?\n/)[0]?.trim();
  return caption || `${media.media_product_type ?? media.media_type ?? "Instagram media"} ${media.id}`;
}

function cleanTitle(title: string) {
  return title.replace(/\s+/g, " ").trim();
}

function cleanAsciiTitle(title: string) {
  return title.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

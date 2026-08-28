import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  hasEligibleMetaFstatsFacebookPageBinding,
  refreshMetaFstatsFacebookPageMetrics
} from "@/lib/metrics/meta-fstats-facebook-page-collector";
import {
  decryptGoogleRefreshToken,
  fetchGoogleJson,
  refreshGoogleAccessToken
} from "@/lib/google/oauth";
import {
  getWorkspaceEnabledCollectors,
  type MetricCollectorName
} from "@/lib/metrics/collector-eligibility";
export type { MetricCollectorName } from "@/lib/metrics/collector-eligibility";
import {
  hasEligibleMetaFstatsInstagramBinding,
  refreshMetaFstatsInstagramMetrics
} from "@/lib/metrics/meta-fstats-instagram-collector";
import {
  hasEligibleMetaCreatorInstagramBinding,
  refreshMetaCreatorInstagramMetrics
} from "@/lib/metrics/meta-creator-instagram-collector";
import {
  hasEligibleMetaCreatorThreadsBinding,
  refreshMetaCreatorThreadsMetrics
} from "@/lib/metrics/meta-creator-threads-collector";
import { defaultWorkspaceId } from "@/lib/workspace";
import { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } from "@/lib/workspace-time";

type CollectorStatus = "fulfilled" | "rejected" | "skipped";

type MetricCollectorResult = {
  metrics?: Record<string, number | string | null>;
  name: "facebook" | "google-analytics" | "instagram" | "standalone-instagram" | "threads" | "spotify" | "youtube" | "youtube-music";
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
  url?: string;
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
type SpotifyArtist = {
  external_urls?: {
    spotify?: string;
  };
  followers?: {
    total?: number;
  };
  id: string;
  name: string;
  popularity?: number;
};
type GoogleAnalyticsReport = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workspaceCollectionRuns = new Map<string, Promise<MetricCollectorResult[]>>();

export async function refreshAllMetricCollectors(workspaceId = defaultWorkspaceId) {
  const startedAt = new Date().toISOString();
  const results = await refreshMetricCollectors(workspaceId);
  return {
    finishedAt: new Date().toISOString(),
    results,
    startedAt
  };
}

/**
 * Runs the selected configured collectors once for a workspace. Connection
 * callbacks use this after writing their canonical binding, so the first card
 * presentation can use collected data without treating collection failure as a
 * failed connection.
 */
export async function refreshMetricCollectors(
  workspaceId: string,
  requestedCollectors?: readonly MetricCollectorName[]
) {
  const key = workspaceId;
  const prior = workspaceCollectionRuns.get(key) ?? Promise.resolve([]);
  const run = prior
    .catch(() => [])
    .then(() => runMetricCollectors(workspaceId, requestedCollectors));
  workspaceCollectionRuns.set(key, run);
  try {
    return await run;
  } finally {
    if (workspaceCollectionRuns.get(key) === run) workspaceCollectionRuns.delete(key);
  }
}

async function runMetricCollectors(
  workspaceId: string,
  requestedCollectors?: readonly MetricCollectorName[]
) {
  const enabledCollectors = await getEnabledCollectorsForWorkspace(workspaceId);
  const requested = requestedCollectors ? new Set(requestedCollectors) : null;
  const collectors: Array<{
    name: MetricCollectorName;
    refresh: () => Promise<MetricCollectorResult>;
  }> = [
    { name: "google-analytics", refresh: () => refreshGoogleAnalyticsMetrics(workspaceId) },
    { name: "facebook", refresh: () => refreshMetaFstatsFacebookPageMetrics(workspaceId, createServiceSupabaseClient()) },
    { name: "youtube", refresh: () => refreshYouTubeMetrics(workspaceId) },
    {
      name: "instagram",
      refresh: async () => ({
        ...(await refreshMetaFstatsInstagramMetrics(workspaceId, createServiceSupabaseClient())),
        name: "instagram" as const
      })
    },
    { name: "standalone-instagram", refresh: () => refreshMetaCreatorInstagramMetrics(workspaceId, createServiceSupabaseClient()) },
    { name: "threads", refresh: () => refreshMetaCreatorThreadsMetrics(workspaceId, createServiceSupabaseClient()) },
    { name: "youtube-music", refresh: () => refreshYouTubeMusicMetrics(workspaceId) },
    { name: "spotify", refresh: () => refreshSpotifyMetrics(workspaceId) }
  ];
  const results = await Promise.allSettled(
    collectors.map((collector) =>
      enabledCollectors.has(collector.name) && (!requested || requested.has(collector.name))
        ? collector.refresh()
        : Promise.resolve({
            name: collector.name,
            reason: "Not configured for this workspace.",
            status: "skipped" as const
          })
    )
  );

  return results.map((result, index): MetricCollectorResult => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      return {
        name: collectors[index].name,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        status: "rejected"
      };
    });
}

async function getEnabledCollectorsForWorkspace(workspaceId: string) {
  const supabase = createServiceSupabaseClient();
  const { data: connection, error } = await supabase
    .from("app_google_connections")
    .select(
      "analytics_enabled, analytics_property_id, youtube_enabled, youtube_channel_id, youtube_topic_channel_id"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw error;

  const instagramConfigured = await hasEligibleMetaFstatsInstagramBinding(workspaceId, supabase);
  const standaloneInstagramConfigured = await hasEligibleMetaCreatorInstagramBinding(workspaceId, supabase);
  const threadsConfigured = await hasEligibleMetaCreatorThreadsBinding(workspaceId, supabase);
  const facebookConfigured = await hasEligibleMetaFstatsFacebookPageBinding(workspaceId, supabase);

  return getWorkspaceEnabledCollectors({
    analyticsConfigured: Boolean(
      connection?.analytics_enabled && connection.analytics_property_id
    ),
    facebookConfigured,
    instagramConfigured,
    standaloneInstagramConfigured,
    threadsConfigured,
    isLegacyWorkspace: workspaceId === defaultWorkspaceId,
    youtubeConfigured: Boolean(connection?.youtube_enabled && connection.youtube_channel_id),
    youtubeTopicConfigured: Boolean(connection?.youtube_topic_channel_id)
  });
}

async function refreshGoogleAnalyticsMetrics(workspaceId: string): Promise<MetricCollectorResult> {
  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  ) {
    return {
      name: "google-analytics",
      reason: "Missing Google OAuth server configuration.",
      status: "skipped"
    };
  }

  const supabase = createServiceSupabaseClient();
  const { data: connection, error } = await supabase
    .from("app_google_connections")
    .select(
      "analytics_enabled, analytics_property_id, analytics_property_name, encrypted_refresh_token"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!connection?.analytics_enabled || !connection.analytics_property_id) {
    return {
      name: "google-analytics",
      reason: "Google Analytics is not connected.",
      status: "skipped"
    };
  }

  const accessToken = await refreshGoogleAccessToken(
    decryptGoogleRefreshToken(connection.encrypted_refresh_token)
  );
  const reportUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${connection.analytics_property_id}:runReport`;
  const dateRanges = [{ endDate: "today", startDate: "29daysAgo" }];
  const [totalsReport, trafficReport] = await Promise.all([
    fetchGoogleJson<GoogleAnalyticsReport>(accessToken, reportUrl, {
      body: JSON.stringify({
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" }
        ]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }),
    fetchGoogleJson<GoogleAnalyticsReport>(accessToken, reportUrl, {
      body: JSON.stringify({
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        limit: "1",
        metrics: [{ name: "sessions" }],
        orderBys: [{ desc: true, metric: { metricName: "sessions" } }]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    })
  ]);
  const totals = totalsReport.rows?.[0]?.metricValues ?? [];
  const activeUsers = Number(totals[0]?.value ?? 0);
  const sessions = Number(totals[1]?.value ?? 0);
  const pageViews = Number(totals[2]?.value ?? 0);
  const topTrafficRow = trafficReport.rows?.[0];
  const topTrafficSource = topTrafficRow?.dimensionValues?.[0]?.value ?? "No traffic yet";
  const topTrafficSessions = Number(topTrafficRow?.metricValues?.[0]?.value ?? 0);
  const propertyName = connection.analytics_property_name ?? "Google Analytics";

  await upsertPlatformMetricSnapshots(
    {
      accountName: propertyName,
      category: "website",
      externalId: connection.analytics_property_id,
      platformName: "Google Analytics",
      platformSlug: "google-analytics",
      url: undefined
    },
    [
      {
        metricName: "active_users_30d",
        metricUnit: "users",
        metricValue: activeUsers
      },
      {
        metricName: "sessions_30d",
        metricUnit: "sessions",
        metricValue: sessions
      },
      {
        metricName: "page_views_30d",
        metricUnit: "views",
        metricValue: pageViews
      },
      {
        metricName: "top_traffic_source_sessions_30d",
        metricUnit: "sessions",
        metricValue: topTrafficSessions,
        notes: topTrafficSource
      }
    ],
    "google-analytics-data-api",
    workspaceId
  );

  return {
    metrics: {
      activeUsers30d: activeUsers,
      pageViews30d: pageViews,
      sessions30d: sessions,
      topTrafficSource,
      topTrafficSourceSessions30d: topTrafficSessions
    },
    name: "google-analytics",
    status: "fulfilled"
  };
}

async function refreshSpotifyMetrics(workspaceId: string): Promise<MetricCollectorResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const artistId = process.env.SPOTIFY_ARTIST_ID ?? "4CESELwcVlIPnfiWuaxRbF";

  if (!clientId || !clientSecret) {
    return {
      name: "spotify",
      reason: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.",
      status: "skipped"
    };
  }

  const accessToken = await fetchSpotifyAccessToken(clientId, clientSecret);
  const artist = await fetchSpotifyJson<SpotifyArtist>(accessToken, `/v1/artists/${artistId}`);

  await upsertPlatformMetricSnapshots(
    {
      accountName: artist.name,
      category: "music",
      externalId: artist.id,
      platformName: "Spotify",
      platformSlug: "spotify",
      url: artist.external_urls?.spotify ?? `https://open.spotify.com/artist/${artist.id}`
    },
    [
      {
        metricName: "followers",
        metricUnit: "count",
        metricValue: Number(artist.followers?.total ?? 0)
      },
      {
        metricName: "popularity_score",
        metricUnit: "score_0_100",
        metricValue: Number(artist.popularity ?? 0)
      }
    ],
    "spotify-web-api",
    workspaceId
  );

  return {
    metrics: {
      followers: Number(artist.followers?.total ?? 0),
      popularityScore: Number(artist.popularity ?? 0)
    },
    name: "spotify",
    status: "fulfilled"
  };
}

async function refreshYouTubeMusicMetrics(workspaceId: string): Promise<MetricCollectorResult> {
  const supabase = createServiceSupabaseClient();
  const { data: connection, error: connectionError } = await supabase
    .from("app_google_connections")
    .select("youtube_topic_channel_id, youtube_topic_channel_title")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection?.youtube_topic_channel_id) {
    return { name: "youtube-music", reason: "YouTube Topic is not configured for this workspace.", status: "skipped" };
  }
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeApiKey) {
    return { name: "youtube-music", reason: "Missing YOUTUBE_API_KEY.", status: "skipped" };
  }

  const channel = await fetchYouTubeJson(youtubeApiKey, "channels", {
    id: connection.youtube_topic_channel_id,
    part: "id,snippet,statistics,contentDetails"
  });
  const channelItem = channel.items?.[0];

  if (!channelItem) {
    throw new Error("The configured YouTube Topic channel could not be found.");
  }

  const tracks = await discoverYouTubeMusicTracks(youtubeApiKey, channelItem);
  const currentRelease = tracks[0] ?? null;

  await upsertPlatformMetricSnapshots(
    {
      accountName: cleanAsciiTitle(channelItem.snippet?.title ?? connection.youtube_topic_channel_title ?? "YouTube Topic"),
      category: "music",
      externalId: channelItem.id,
      platformName: "YouTube Topic",
      platformSlug: "youtube-music",
      url: `https://www.youtube.com/channel/${channelItem.id}`
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
              metricName: "current_release_name",
              metricUnit: "text",
              metricValue: 0,
              notes: cleanMusicTitle(currentRelease.snippet?.title ?? "Current release")
            },
            {
              metricName: "current_release_published_at",
              metricUnit: "date",
              metricValue: 0,
              notes: String(currentRelease.snippet?.publishedAt ?? "").slice(0, 10)
            },
            {
              contentExternalId: currentRelease.id,
              contentTitle: cleanMusicTitle(currentRelease.snippet?.title ?? "Current release"),
              contentType: "track",
              contentUrl: `https://music.youtube.com/watch?v=${currentRelease.id}`,
              metricName: "current_release_plays",
              metricUnit: "plays",
              metricValue: Number(currentRelease.statistics?.viewCount ?? 0),
              notes: cleanMusicTitle(currentRelease.snippet?.title ?? "Current release")
            }
          ]
        : [])
    ],
    "youtube-data-api",
    workspaceId
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

async function refreshYouTubeMetrics(workspaceId: string): Promise<MetricCollectorResult> {
  const supabase = createServiceSupabaseClient();
  const { data: connection, error: connectionError } = await supabase
    .from("app_google_connections")
    .select("youtube_enabled, youtube_channel_id, youtube_channel_title")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (connectionError) throw connectionError;
  if (!connection?.youtube_enabled || !connection.youtube_channel_id) {
    return {
      name: "youtube",
      reason: "YouTube is not connected for this workspace.",
      status: "skipped"
    };
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeApiKey) {
    return { name: "youtube", reason: "Missing YOUTUBE_API_KEY.", status: "skipped" };
  }

  const maxUploadsToInspect = Number(process.env.YOUTUBE_UPLOADS_TO_INSPECT ?? 25);
  const maxShortDurationSeconds = Number(process.env.YOUTUBE_SHORT_MAX_SECONDS ?? 180);

  const channel = await fetchYouTubeJson(youtubeApiKey, "channels", {
    id: connection.youtube_channel_id,
    part: "id,snippet,statistics,contentDetails"
  });
  const channelItem = channel.items?.[0];

  if (!channelItem) {
    throw new Error("The configured YouTube channel could not be found.");
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
      accountName: cleanAsciiTitle(
        channelItem.snippet?.title ?? connection.youtube_channel_title ?? "YouTube channel"
      ),
      category: "video",
      externalId: channelItem.id,
      platformName: "YouTube",
      platformSlug: "youtube",
      url: `https://www.youtube.com/channel/${channelItem.id}`
    },
    [
      {
        metricName: "subscribers",
        metricUnit: "count",
        metricValue: Number(channelItem.statistics?.subscriberCount ?? 0)
      },
      {
        metricName: "total_channel_views",
        metricUnit: "views",
        metricValue: Number(channelItem.statistics?.viewCount ?? 0)
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
    "youtube-data-api",
    workspaceId
  );

  return {
    metrics: {
      latestShortViews: Number(latestShort.statistics?.viewCount ?? 0),
      latestVideoViews: Number(latestVideo.statistics?.viewCount ?? 0),
      subscribers: Number(channelItem.statistics?.subscriberCount ?? 0),
      totalChannelViews: Number(channelItem.statistics?.viewCount ?? 0)
    },
    name: "youtube",
    status: "fulfilled"
  };
}

async function upsertPlatformMetricSnapshots(
  accountInput: PlatformAccountInput,
  snapshots: MetricSnapshotInput[],
  source: string,
  workspaceId: string
) {
  const supabase = createServiceSupabaseClient();
  const snapshotDate = await getWorkspaceSnapshotDate(supabase, workspaceId);
  const importedAt = new Date().toISOString();
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

  let accountUrl = accountInput.url;
  if (accountUrl === undefined) {
    const { data: existing, error: existingError } = await supabase
      .from("platform_accounts")
      .select("url")
      .eq("workspace_id", workspaceId)
      .eq("platform_id", platform.id)
      .eq("account_name", accountInput.accountName)
      .maybeSingle();
    if (existingError) throw existingError;
    accountUrl = existing?.url ?? null;
  }

  const { data: account, error: accountError } = await supabase
    .from("platform_accounts")
    .upsert(
      {
        account_name: accountInput.accountName,
        external_id: accountInput.externalId,
        platform_id: platform.id,
        url: accountUrl,
        workspace_id: workspaceId
      },
      { onConflict: "workspace_id,platform_id,account_name" }
    )
    .select("id")
    .single();

  if (accountError) throw accountError;

  for (const snapshot of snapshots) {
    const contentPostId = snapshot.contentExternalId
      ? await upsertContentPost(supabase, account.id, snapshot, workspaceId)
      : null;

    const { error } = await supabase
      .from("platform_metric_snapshots")
      .upsert(
        {
          content_post_id: contentPostId,
          imported_at: importedAt,
          metric_name: snapshot.metricName,
          metric_unit: snapshot.metricUnit,
          metric_value: snapshot.metricValue,
          notes: snapshot.notes ?? null,
          platform_account_id: account.id,
          platform_id: platform.id,
          snapshot_date: snapshotDate,
          source,
          workspace_id: workspaceId
        },
        {
          onConflict:
            "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source"
        }
      );

    if (error) throw error;
  }
}

async function getWorkspaceSnapshotDate(supabase: SupabaseClient, workspaceId: string) {
  const { data, error } = await supabase
    .from("app_workspace_settings")
    .select("timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;

  return getWorkspaceDateKey(
    resolveTimeZone(data?.timezone) ?? defaultWorkspaceTimeZone
  );
}

async function upsertContentPost(
  supabase: SupabaseClient,
  platformAccountId: string,
  snapshot: MetricSnapshotInput,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from("content_posts")
    .upsert(
      {
        content_type: snapshot.contentType ?? "post",
        external_id: snapshot.contentExternalId,
        platform_account_id: platformAccountId,
        title: snapshot.contentTitle,
        url: snapshot.contentUrl,
        workspace_id: workspaceId
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

async function fetchSpotifyAccessToken(clientId: string, clientSecret: string) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return String(data.access_token);
}

async function fetchSpotifyJson<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Spotify API request failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<T>;
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

function cleanAsciiTitle(title: string) {
  return title.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

function cleanMusicTitle(title: string) {
  return title.replace(/\s+/gu, " ").trim();
}

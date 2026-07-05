import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = new URL("..", import.meta.url);
const env = loadEnv(new URL(".env.local", projectRoot));

const youtubeApiKey = env.YOUTUBE_API_KEY;
const channelHandle = env.YOUTUBE_CHANNEL_HANDLE ?? "@LoveStringsBand";
const fallbackLatestVideoUrl = env.YOUTUBE_LATEST_VIDEO_URL ?? "https://youtu.be/uoJpyT6ktlk";
const fallbackLatestShortUrl = env.YOUTUBE_LATEST_SHORT_URL ?? "https://youtube.com/shorts/EtL-6xXKYjA";
const maxUploadsToInspect = Number(env.YOUTUBE_UPLOADS_TO_INSPECT ?? 25);
const maxShortDurationSeconds = Number(env.YOUTUBE_SHORT_MAX_SECONDS ?? 180);
const shouldApply = process.argv.includes("--apply");

if (!youtubeApiKey) {
  throw new Error("Missing YOUTUBE_API_KEY in .env.local.");
}

const channel = await fetchYouTubeJson("channels", {
  forHandle: channelHandle,
  part: "id,snippet,statistics,contentDetails"
});

const channelItem = channel.items?.[0];

if (!channelItem) {
  throw new Error(`No YouTube channel found for handle ${channelHandle}.`);
}

const discoveredUploads = await discoverLatestUploads(channelItem, maxUploadsToInspect);
const fallbackLatestVideoId = extractYouTubeVideoId(fallbackLatestVideoUrl);
const fallbackLatestShortId = extractYouTubeVideoId(fallbackLatestShortUrl);

if (!discoveredUploads.latestVideo && !fallbackLatestVideoId) {
  throw new Error("Could not discover the latest YouTube video and no fallback video URL is configured.");
}

if (!discoveredUploads.latestShort && !fallbackLatestShortId) {
  throw new Error("Could not discover the latest YouTube Short and no fallback Short URL is configured.");
}

const latestVideoId = discoveredUploads.latestVideo?.id ?? fallbackLatestVideoId;
const latestShortId = discoveredUploads.latestShort?.id ?? fallbackLatestShortId;

const videos = await fetchYouTubeJson("videos", {
  id: `${latestVideoId},${latestShortId}`,
  part: "id,snippet,statistics,contentDetails"
});

const videoById = new Map(videos.items?.map((item) => [item.id, item]) ?? []);
const latestVideo = videoById.get(latestVideoId);
const latestShort = videoById.get(latestShortId);

if (!latestVideo || !latestShort) {
  throw new Error("Could not fetch one or more YouTube video stat records.");
}

const snapshotDate = new Date().toISOString().slice(0, 10);
const metrics = {
  channelId: channelItem.id,
  channelTitle: channelItem.snippet?.title ?? "Love Strings YouTube Channel",
  subscribers: Number(channelItem.statistics?.subscriberCount ?? 0),
  latestVideoId,
  latestVideoTitle: cleanTitle(latestVideo.snippet?.title ?? "Latest video"),
  latestVideoViews: Number(latestVideo.statistics?.viewCount ?? 0),
  latestShortId,
  latestShortTitle: cleanTitle(latestShort.snippet?.title ?? "Latest short"),
  latestShortViews: Number(latestShort.statistics?.viewCount ?? 0),
  discovery: {
    inspectedUploads: discoveredUploads.inspectedUploads,
    latestVideoSource: discoveredUploads.latestVideo ? "channel-uploads" : "fallback-url",
    latestShortSource: discoveredUploads.latestShort ? "channel-uploads" : "fallback-url"
  }
};

const sql = buildSql(snapshotDate, metrics);

if (!shouldApply) {
  console.log(JSON.stringify({ snapshotDate, metrics }, null, 2));
  console.log("Run with --apply to write these values to Supabase.");
  process.exit(0);
}

const sqlFile = join(tmpdir(), `love-strings-youtube-${Date.now()}.sql`);
writeFileSync(sqlFile, sql, "utf8");

const result = spawnSync(
  "pnpm",
  ["dlx", "supabase", "db", "query", "--linked", "--file", sqlFile],
  {
    cwd: new URL(".", projectRoot),
    encoding: "utf8",
    stdio: "pipe"
  }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  throw new Error("Failed to write YouTube metrics to Supabase.");
}

console.log(
  JSON.stringify(
    {
      snapshotDate,
      imported: {
        subscribers: metrics.subscribers,
        latestVideoTitle: metrics.latestVideoTitle,
        latestVideoViews: metrics.latestVideoViews,
        latestShortTitle: metrics.latestShortTitle,
        latestShortViews: metrics.latestShortViews,
        discovery: metrics.discovery
      }
    },
    null,
    2
  )
);

function loadEnv(fileUrl) {
  const values = {};

  try {
    const content = readFileSync(fileUrl, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      values[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    return values;
  }

  return values;
}

async function fetchYouTubeJson(resource, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  url.searchParams.set("key", youtubeApiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube API request failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function discoverLatestUploads(channelItem, uploadLimit) {
  const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    return { latestVideo: null, latestShort: null, inspectedUploads: 0 };
  }

  const playlist = await fetchYouTubeJson("playlistItems", {
    playlistId: uploadsPlaylistId,
    part: "snippet,contentDetails",
    maxResults: String(Math.max(1, Math.min(uploadLimit, 50)))
  });

  const uploadIds =
    playlist.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter(Boolean) ?? [];

  if (uploadIds.length === 0) {
    return { latestVideo: null, latestShort: null, inspectedUploads: 0 };
  }

  const videos = await fetchYouTubeJson("videos", {
    id: uploadIds.join(","),
    part: "id,snippet,statistics,contentDetails"
  });

  const uploads =
    videos.items
      ?.map((item) => ({
        id: item.id,
        title: item.snippet?.title ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        durationSeconds: parseYouTubeDurationSeconds(item.contentDetails?.duration ?? "PT0S")
      }))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) ?? [];

  return {
    latestVideo: uploads.find((upload) => !isShortUpload(upload)) ?? null,
    latestShort: uploads.find((upload) => isShortUpload(upload)) ?? null,
    inspectedUploads: uploads.length
  };
}

function isShortUpload(upload) {
  return upload.durationSeconds > 0 && upload.durationSeconds <= maxShortDurationSeconds;
}

function parseYouTubeDurationSeconds(duration) {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);

  if (!match) {
    return 0;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function extractYouTubeVideoId(url) {
  const parsed = new URL(url);

  if (parsed.hostname === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0];
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    return parsed.pathname.split("/").filter(Boolean)[1];
  }

  return parsed.searchParams.get("v");
}

function cleanTitle(title) {
  return title.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql(snapshotDate, data) {
  return `
insert into public.platforms (slug, name, category)
values ('youtube', 'YouTube', 'video')
on conflict (slug) do update
set name = excluded.name, category = excluded.category;

insert into public.platform_accounts (
  platform_id,
  account_name,
  external_id,
  url
)
select
  p.id,
  'Love Strings YouTube Channel',
  ${sqlText(data.channelId)},
  'https://www.youtube.com/@LoveStringsBand'
from public.platforms p
where p.slug = 'youtube'
on conflict (platform_id, account_name) do update
set
  external_id = excluded.external_id,
  url = excluded.url;

with youtube_account as (
  select pa.id
  from public.platform_accounts pa
  join public.platforms p on p.id = pa.platform_id
  where p.slug = 'youtube'
    and pa.account_name = 'Love Strings YouTube Channel'
)
insert into public.content_posts (
  platform_account_id,
  title,
  content_type,
  external_id,
  url
)
values
  (
    (select id from youtube_account),
    ${sqlText(data.latestVideoTitle)},
    'video',
    ${sqlText(data.latestVideoId)},
    ${sqlText(`https://youtu.be/${data.latestVideoId}`)}
  ),
  (
    (select id from youtube_account),
    ${sqlText(data.latestShortTitle)},
    'short',
    ${sqlText(data.latestShortId)},
    ${sqlText(`https://youtube.com/shorts/${data.latestShortId}`)}
  )
on conflict (platform_account_id, external_id) do update
set
  title = excluded.title,
  content_type = excluded.content_type,
  url = excluded.url;

with youtube_platform as (
  select id from public.platforms where slug = 'youtube'
),
youtube_account as (
  select pa.id
  from public.platform_accounts pa
  join youtube_platform p on p.id = pa.platform_id
  where pa.account_name = 'Love Strings YouTube Channel'
),
metric_seed as (
  select *
  from (
    values
      (null, 'subscribers', ${data.subscribers}, 'count', null),
      (${sqlText(data.latestVideoId)}, 'latest_video_views', ${data.latestVideoViews}, 'views', ${sqlText(data.latestVideoTitle)}),
      (${sqlText(data.latestShortId)}, 'latest_short_views', ${data.latestShortViews}, 'views', ${sqlText(data.latestShortTitle)})
  ) as v(content_external_id, metric_name, metric_value, metric_unit, notes)
),
resolved_metric_seed as (
  select
    date ${sqlText(snapshotDate)} as snapshot_date,
    (select id from youtube_platform) as platform_id,
    (select id from youtube_account) as platform_account_id,
    cp.id as content_post_id,
    metric_seed.metric_name,
    metric_seed.metric_value,
    metric_seed.metric_unit,
    metric_seed.notes
  from metric_seed
  left join public.content_posts cp
    on cp.platform_account_id = (select id from youtube_account)
    and cp.external_id = metric_seed.content_external_id
)
insert into public.platform_metric_snapshots (
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  metric_name,
  metric_value,
  metric_unit,
  source,
  notes
)
select
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  metric_name,
  metric_value,
  metric_unit,
  'youtube-data-api',
  notes
from resolved_metric_seed
on conflict (
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  song_id,
  release_id,
  metric_name,
  source
)
do update
set
  metric_value = excluded.metric_value,
  metric_unit = excluded.metric_unit,
  notes = excluded.notes,
  imported_at = now();
`;
}

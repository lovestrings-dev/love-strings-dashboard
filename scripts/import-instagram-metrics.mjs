import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = new URL("..", import.meta.url);
const env = loadEnv(new URL(".env.local", projectRoot));

const accessToken = env.INSTAGRAM_ACCESS_TOKEN;
const instagramAccountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const graphApiVersion = env.INSTAGRAM_GRAPH_API_VERSION ?? "v23.0";
const shouldApply = process.argv.includes("--apply");

if (!accessToken) {
  throw new Error("Missing INSTAGRAM_ACCESS_TOKEN in .env.local.");
}

if (!instagramAccountId) {
  throw new Error("Missing INSTAGRAM_BUSINESS_ACCOUNT_ID in .env.local.");
}

const account = await fetchInstagramJson(instagramAccountId, {
  fields: "id,username,name,profile_picture_url,followers_count,follows_count,media_count"
});

const media = await fetchInstagramJson(`${instagramAccountId}/media`, {
  fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
  limit: "10"
});

const accountReach = await fetchAccountInsight30d(instagramAccountId, "reach");
const accountViews = await fetchAccountInsight30d(instagramAccountId, "views");
const latestMedia = getLatestMedia(media.data ?? []);
const latestMediaInsights = latestMedia
  ? await fetchFirstAvailableInsights(latestMedia.id, [
      ["views", "reach"],
      ["plays", "reach"],
      ["impressions", "reach"]
    ])
  : { metrics: {}, source: "no-media" };

const snapshotDate = new Date().toISOString().slice(0, 10);
const metrics = {
  accountId: account.id,
  username: account.username ?? "lovestringsband",
  accountName: account.name ?? "Love Strings Instagram",
  followers: Number(account.followers_count ?? 0),
  follows: Number(account.follows_count ?? 0),
  mediaCount: Number(account.media_count ?? 0),
  accountsReached30d: accountReach.value,
  accountsReached30dSource: accountReach.source,
  views30d: accountViews.value,
  views30dSource: accountViews.source,
  accountInsightAttempts: accountReach.attempts,
  accountViewsAttempts: accountViews.attempts,
  latestMedia: latestMedia
    ? {
        id: latestMedia.id,
        title: cleanTitle(getMediaTitle(latestMedia)),
        type: latestMedia.media_type ?? "MEDIA",
        productType: latestMedia.media_product_type ?? null,
        permalink: latestMedia.permalink ?? null,
        timestamp: latestMedia.timestamp ?? null,
        likes: Number(latestMedia.like_count ?? 0),
        comments: Number(latestMedia.comments_count ?? 0),
        views: latestMediaInsights.metrics.views ?? latestMediaInsights.metrics.plays ?? null,
        reach: latestMediaInsights.metrics.reach ?? latestMediaInsights.metrics.impressions ?? null,
        insightSource: latestMediaInsights.source
      }
    : null
};

const sql = buildSql(snapshotDate, metrics);

if (!shouldApply) {
  console.log(JSON.stringify({ snapshotDate, metrics }, null, 2));
  console.log("Run with --apply to write these values to Supabase.");
  process.exit(0);
}

const sqlFile = join(tmpdir(), `love-strings-instagram-${Date.now()}.sql`);
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
  throw new Error("Failed to write Instagram metrics to Supabase.");
}

console.log(
  JSON.stringify(
    {
      snapshotDate,
      imported: {
        username: metrics.username,
        followers: metrics.followers,
        accountsReached30d: metrics.accountsReached30d,
        accountsReached30dSource: metrics.accountsReached30dSource,
        views30d: metrics.views30d,
        views30dSource: metrics.views30dSource,
        mediaCount: metrics.mediaCount,
        latestMediaTitle: metrics.latestMedia?.title ?? null,
        latestMediaViews: metrics.latestMedia?.views ?? null,
        latestMediaReach: metrics.latestMedia?.reach ?? null,
        insightSource: metrics.latestMedia?.insightSource ?? null
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

async function fetchInstagramJson(path, params) {
  const url = new URL(`https://graph.instagram.com/${graphApiVersion}/${path}`);
  url.searchParams.set("access_token", accessToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Instagram API request failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function fetchFirstAvailableInsights(mediaId, metricSets) {
  for (const metricNames of metricSets) {
    try {
      const response = await fetchInstagramJson(`${mediaId}/insights`, {
        metric: metricNames.join(",")
      });

      return {
        metrics: mapInsightValues(response.data ?? []),
        source: metricNames.join(",")
      };
    } catch (error) {
      if (!String(error.message).includes("Instagram API request failed")) {
        throw error;
      }
    }
  }

  return { metrics: {}, source: "unavailable" };
}

async function fetchAccountInsight30d(accountId, metricName) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 60 * 60;
  const attempts = [];
  const candidates = [
    {
      source: `${metricName}-period-day-total-value`,
      params: {
        metric: metricName,
        period: "day",
        metric_type: "total_value",
        since: String(since),
        until: String(until)
      }
    },
    {
      source: `${metricName}-period-days-28-total-value`,
      params: {
        metric: metricName,
        period: "days_28",
        metric_type: "total_value"
      }
    },
    {
      source: `${metricName}-period-day-values-sum`,
      params: {
        metric: metricName,
        period: "day",
        since: String(since),
        until: String(until)
      }
    }
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetchInstagramJson(`${accountId}/insights`, candidate.params);
      const value = getInsightResponseValue(response.data ?? []);

      attempts.push({
        source: candidate.source,
        ok: true,
        value
      });

      if (value !== null) {
        return {
          attempts,
          source: candidate.source,
          value
        };
      }
    } catch (error) {
      attempts.push({
        source: candidate.source,
        ok: false,
        error: sanitizeApiError(error.message)
      });
    }
  }

  return {
    attempts,
    source: "unavailable",
    value: null
  };
}

function getInsightResponseValue(insights) {
  const firstInsight = insights[0];

  if (!firstInsight) {
    return null;
  }

  if (firstInsight.total_value?.value !== undefined) {
    return Number(firstInsight.total_value.value);
  }

  if (Array.isArray(firstInsight.values) && firstInsight.values.length > 0) {
    return firstInsight.values.reduce(
      (total, item) => total + Number(item.value ?? 0),
      0
    );
  }

  return null;
}

function mapInsightValues(insights) {
  return Object.fromEntries(
    insights.map((insight) => [
      insight.name,
      Number(insight.values?.[0]?.value ?? 0)
    ])
  );
}

function getLatestMedia(mediaItems) {
  return mediaItems
    .slice()
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())[0] ?? null;
}

function getMediaTitle(media) {
  const caption = media.caption?.split(/\r?\n/)[0]?.trim();
  return caption || `${media.media_product_type ?? media.media_type ?? "Instagram media"} ${media.id}`;
}

function cleanTitle(title) {
  return title.replace(/\s+/g, " ").trim();
}

function sqlText(value) {
  return value === null || value === undefined
    ? "null"
    : `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql(snapshotDate, data) {
  const latestMediaMetricRows = data.latestMedia
    ? `,
      (${sqlText(data.latestMedia.id)}, 'latest_reel_post_views', ${Number(data.latestMedia.views ?? 0)}, 'views', ${sqlText(data.latestMedia.title)}),
      (${sqlText(data.latestMedia.id)}, 'latest_reel_post_reach', ${Number(data.latestMedia.reach ?? 0)}, 'count', ${sqlText(data.latestMedia.title)})`
    : "";

  return `
insert into public.platforms (slug, name, category)
values ('instagram', 'Instagram', 'social')
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
  'Love Strings Instagram',
  ${sqlText(data.accountId)},
  ${sqlText(`https://www.instagram.com/${data.username}/`)}
from public.platforms p
where p.slug = 'instagram'
on conflict (platform_id, account_name) do update
set
  external_id = excluded.external_id,
  url = excluded.url;

with instagram_account as (
  select pa.id
  from public.platform_accounts pa
  join public.platforms p on p.id = pa.platform_id
  where p.slug = 'instagram'
    and pa.account_name = 'Love Strings Instagram'
)
insert into public.content_posts (
  platform_account_id,
  title,
  content_type,
  external_id,
  url
)
select
  (select id from instagram_account),
  ${sqlText(data.latestMedia?.title)},
  ${sqlText(data.latestMedia?.productType === "REELS" ? "reel" : "post")},
  ${sqlText(data.latestMedia?.id)},
  ${sqlText(data.latestMedia?.permalink)}
where ${data.latestMedia ? "true" : "false"}
on conflict (platform_account_id, external_id) do update
set
  title = excluded.title,
  content_type = excluded.content_type,
  url = excluded.url;

with instagram_platform as (
  select id from public.platforms where slug = 'instagram'
),
instagram_account as (
  select pa.id
  from public.platform_accounts pa
  join instagram_platform p on p.id = pa.platform_id
  where pa.account_name = 'Love Strings Instagram'
),
metric_seed as (
  select *
  from (
    values
      (null, 'followers', ${data.followers}, 'count', null),
      (null, 'accounts_reached_30d', ${Number(data.accountsReached30d ?? 0)}, 'count', null),
      (null, 'views_30d', ${Number(data.views30d ?? 0)}, 'views', null),
      (null, 'media_count', ${data.mediaCount}, 'count', null)
      ${latestMediaMetricRows}
  ) as v(content_external_id, metric_name, metric_value, metric_unit, notes)
),
resolved_metric_seed as (
  select
    date ${sqlText(snapshotDate)} as snapshot_date,
    (select id from instagram_platform) as platform_id,
    (select id from instagram_account) as platform_account_id,
    cp.id as content_post_id,
    metric_seed.metric_name,
    metric_seed.metric_value,
    metric_seed.metric_unit,
    metric_seed.notes
  from metric_seed
  left join public.content_posts cp
    on cp.platform_account_id = (select id from instagram_account)
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
  'instagram-api',
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

function sanitizeApiError(message) {
  return message
    .replace(/"access_token":"[^"]+"/g, '"access_token":"[hidden]"')
    .replace(/access_token=[^&\s"]+/g, "access_token=[hidden]");
}

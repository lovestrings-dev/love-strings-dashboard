import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { discoverYouTubeMusicTracks, fetchYouTubeJson, YouTubeDataError } from "../lib/metrics/youtube-data.ts";
const originalFetch = globalThis.fetch;
const channel = { id: "topic-a", contentDetails: { relatedPlaylists: { uploads: "uploads-a" } } };
const track = (id, publishedAt, channelId = "topic-a") => ({ id, snippet: { channelId, publishedAt, title: id }, statistics: { viewCount: "12" } });
let calls = [], responders = {};
globalThis.fetch = async (input) => {
  const url = new URL(input); const resource = url.pathname.split("/").at(-1);
  calls.push({ resource, params: Object.fromEntries(url.searchParams) });
  assert.ok(responders[resource], `Unexpected request: ${resource}`);
  return responders[resource](url);
};
const json = (data, status = 200) => Response.json(data, { status });
const missing = () => json({ error: { errors: [{ reason: "playlistNotFound" }], message: "raw <code>payload</code>" } }, 404);
const searches = () => json({ items: [{ id: { videoId: "recent" }, snippet: { channelId: "topic-a" } }, { id: { videoId: "wrong" }, snippet: { channelId: "other" } }] });
try {
  responders = { playlistItems: () => json({ items: [{ contentDetails: { videoId: "old" } }, { contentDetails: { videoId: "recent" } }] }), videos: () => json({ items: [track("old", "2026-01-01"), track("recent", "2026-11-01"), track("foreign", "2027-01-01", "other")] }) };
  assert.equal((await discoverYouTubeMusicTracks("secret-key", channel))[0].id, "recent");
  assert.deepEqual(calls.map(x => x.resource), ["playlistItems", "videos"]);
  calls = [];
  responders.playlistItems = missing; responders.search = searches;
  assert.equal((await discoverYouTubeMusicTracks("secret-key", channel))[0].id, "recent");
  assert.deepEqual(calls.map(x => x.resource), ["playlistItems", "search", "videos"]);
  assert.equal(calls[1].params.channelId, "topic-a"); assert.equal(calls[1].params.type, "video"); assert.equal(calls[1].params.order, "date");
  assert.equal(calls[2].params.id, "recent");
  for (const [status, reason] of [[403,"quotaExceeded"], [403,"keyInvalid"], [500,"backendError"], [404,"otherNotFound"]]) {
    calls = []; responders.playlistItems = () => json({ error: { errors: [{ reason }], message: "secret-key raw payload" } }, status);
    await assert.rejects(discoverYouTubeMusicTracks("secret-key", channel), error => error instanceof YouTubeDataError && !error.message.includes("secret-key") && !error.message.includes("raw payload"));
    assert.equal(calls.length, 1, "Do not search after unrelated API errors");
  }
  calls = []; responders.playlistItems = missing; responders.search = () => json({ items: [] });
  assert.deepEqual(await discoverYouTubeMusicTracks("secret-key", channel), []);
  assert.deepEqual(calls.map(x => x.resource), ["playlistItems", "search"]);
  calls = []; responders.search = searches;
  await discoverYouTubeMusicTracks("secret-key", { id: "topic-a" });
  assert.deepEqual(calls.map(x => x.resource), ["search", "videos"]);
  responders.search = () => json({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403);
  await assert.rejects(discoverYouTubeMusicTracks("secret-key", { id: "topic-a" }), /request limit/);
  responders.channels = () => new Response("unparseable proxy response", { status: 502 });
  await assert.rejects(fetchYouTubeJson("secret-key", "channels", {}), /could not provide statistics/);

  // Exercise the real collector persistence path with mocked Supabase writes.
  // No fixture, token, connection or remote database mutation occurs.
  const saved = [];
  const client = { from(table) { return {
    upsert(row) { saved.push({ table, row }); return this; }, select() { return this; }, eq() { return this; },
    async single() { return { data: { id: `${table}-id` } }; },
    async maybeSingle() { return { data: table === "app_google_connections" ? { youtube_topic_channel_id: "topic-a", youtube_enabled: true, youtube_channel_id: "channel-a" } : { timezone: "Europe/Vienna" } }; }
  }; } };
  const source = readFileSync(new URL("../lib/metrics/collectors.ts", import.meta.url), "utf8") + "\nexport const youtubeTest = { refreshYouTubeMusicMetrics, refreshYouTubeMetrics };";
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const mocks = {
    "@supabase/supabase-js": { createClient: () => client },
    "@/lib/metrics/youtube-data": { discoverYouTubeMusicTracks, fetchYouTubeJson },
    "@/lib/workspace-time": { getWorkspaceDateKey: () => "2026-11-04", resolveTimeZone: value => value }
  };
  vm.runInNewContext(compiled, { exports, require: name => mocks[name] ?? {}, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test", YOUTUBE_API_KEY: "test" } }, Date, Map, Set, URL, console });
  responders.channels = () => json({ items: [{ ...channel, snippet: { title: "Topic" }, statistics: { subscriberCount: "5", viewCount: "75" } }] });
  responders.playlistItems = missing; responders.search = () => json({ items: [] });
  const result = await exports.youtubeTest.refreshYouTubeMusicMetrics("workspace-a");
  assert.equal(result.status, "fulfilled"); assert.equal(result.metrics.currentReleasePlays, null); assert.match(result.reason, /current release.*unavailable/);
  let snapshots = saved.filter(x => x.table === "platform_metric_snapshots").map(x => x.row);
  assert.deepEqual(snapshots.map(x => x.metric_name), ["subscribers", "total_plays"]);
  assert.ok(snapshots.every(x => x.workspace_id === "workspace-a"));
  saved.length = 0; responders.search = searches;
  const recovered = await exports.youtubeTest.refreshYouTubeMusicMetrics("workspace-a");
  assert.equal(recovered.metrics.currentReleaseTitle, "recent"); assert.equal(recovered.metrics.currentReleasePlays, 12);
  snapshots = saved.filter(x => x.table === "platform_metric_snapshots").map(x => x.row);
  assert.equal(snapshots.find(x => x.metric_name === "current_release_plays").metric_value, 12);

  // Regular YouTube Channel collection still discovers video and Short normally.
  responders.channels = () => json({ items: [{ id: "channel-a", contentDetails: channel.contentDetails, statistics: { subscriberCount: "39", viewCount: "100" } }] });
  responders.playlistItems = () => json({ items: [{ contentDetails: { videoId: "video" } }, { contentDetails: { videoId: "short" } }] });
  responders.videos = url => url.searchParams.get("part").includes("contentDetails")
    ? json({ items: [{ id: "video", contentDetails: { duration: "PT4M" } }, { id: "short", contentDetails: { duration: "PT30S" } }] })
    : json({ items: [{ id: "video", statistics: { viewCount: "50" } }, { id: "short", statistics: { viewCount: "20" } }] });
  saved.length = 0;
  const regular = await exports.youtubeTest.refreshYouTubeMetrics("workspace-a");
  assert.equal(regular.status, "fulfilled"); assert.equal(regular.metrics.latestVideoViews, 50); assert.equal(regular.metrics.latestShortViews, 20);
  globalThis.fetch = async () => { throw new Error("https://example.test/?key=secret-key"); };
  await assert.rejects(fetchYouTubeJson("secret-key", "channels", {}), error => !error.message.includes("secret-key") && error.message.includes("could not be reached"));
  console.log("YouTube Topic fallback, isolation, quota/error handling, no fabricated release writes, partial totals and regular Channel collector passed (mocked writes).");
} finally { globalThis.fetch = originalFetch; }

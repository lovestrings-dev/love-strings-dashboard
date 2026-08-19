import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptMetaTokenPayload } from "@/lib/meta/tokens";
import { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } from "@/lib/workspace-time";

// App A uses the direct Instagram Login API, not Facebook Graph/Page semantics.
const graphHost = "https://graph.instagram.com";
const graphVersion = "v25.0";
export const creatorInstagramMetricSource = "instagram-login-api";

type FetchLike = typeof fetch;
type Account = { id: string; workspace_id: string; platform_id: string; meta_external_id: string | null; account_name: string; url: string | null };
type Connection = { id: string; encrypted_token_payload: string | null; connection_state: string };
type Mapping = { account_type: string; platform_account_id: string; is_selected: boolean; asset_state: string };
type Media = { id: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; timestamp?: string };

export class MetaCreatorInstagramCollectorError extends Error {
  constructor(message: string) { super(message); this.name = "MetaCreatorInstagramCollectorError"; }
}

export async function refreshMetaCreatorInstagramMetrics(workspaceId: string, client: SupabaseClient, fetchImpl: FetchLike = fetch, now = new Date()) {
  const resolved = await resolveAuthoritativeCreatorInstagram(client, workspaceId);
  let token: string;
  try { token = decryptMetaTokenPayload(resolved.connection.encrypted_token_payload!).accessToken; }
  catch { throw new MetaCreatorInstagramCollectorError("Standalone Instagram authorization could not be decrypted."); }

  const until = Math.floor(now.getTime() / 1000);
  const since = until - 30 * 24 * 60 * 60;
  const insightParams = (metric: string) => ({ metric, metric_type: "total_value", period: "day", since: String(since), until: String(until) });
  const accountParams = { fields: "id,username,name,followers_count" };
  const mediaParams = { fields: "id,caption,media_type,media_product_type,permalink,timestamp", limit: "10" };
  const externalId = resolved.account.meta_external_id!;
  const [account, mediaPayload, reachPayload, viewsPayload, settingResult] = await Promise.all([
    instagramJson<Record<string, unknown>>(fetchImpl, "/me", token, accountParams),
    instagramJson<{ data?: Media[] }>(fetchImpl, "/me/media", token, mediaParams),
    instagramJson<{ data?: unknown[] }>(fetchImpl, "/me/insights", token, insightParams("reach")),
    instagramJson<{ data?: unknown[] }>(fetchImpl, "/me/insights", token, insightParams("views")),
    client.from("app_workspace_settings").select("timezone").eq("workspace_id", workspaceId).maybeSingle()
  ]);
  if (settingResult.error) throw new MetaCreatorInstagramCollectorError("Workspace snapshot date could not be resolved.");
  if (account.id !== externalId || !finiteNumber(account.followers_count)) throw new MetaCreatorInstagramCollectorError("Standalone Instagram profile response is missing a compatible follower count.");
  const reach = insightValue(reachPayload.data, "reach");
  const views = insightValue(viewsPayload.data, "views");
  if (reach === null || views === null) throw new MetaCreatorInstagramCollectorError("Standalone Instagram insights response is missing a compatible 30-day metric.");
  const snapshotDate = getWorkspaceDateKey(resolveTimeZone(settingResult.data?.timezone) ?? defaultWorkspaceTimeZone);
  const collectedAt = now.toISOString();
  const baseMetrics = [
    { metric_name: "followers", metric_unit: "count", metric_value: Number(account.followers_count) },
    { metric_name: "accounts_reached_30d", metric_unit: "count", metric_value: reach },
    { metric_name: "views_30d", metric_unit: "views", metric_value: views }
  ];
  const { error: snapshotError } = await client.from("platform_metric_snapshots").upsert(
    baseMetrics.map((metric) => snapshot(resolved.account, workspaceId, snapshotDate, collectedAt, metric, null)),
    { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" }
  );
  if (snapshotError) throw new MetaCreatorInstagramCollectorError("Standalone Instagram metrics could not be persisted.");

  const latestMedia = latest(mediaPayload.data ?? []);
  let latestMediaViews: number | null = null;
  if (latestMedia) {
    const mediaInsight = await firstMediaInsights(fetchImpl, token, latestMedia.id);
    latestMediaViews = mediaInsight.value;
    const { data: post, error: postError } = await client.from("content_posts").upsert({
      content_type: latestMedia.media_product_type === "REELS" ? "reel" : "post", external_id: latestMedia.id,
      platform_account_id: resolved.account.id, title: mediaTitle(latestMedia), url: latestMedia.permalink ?? null, workspace_id: workspaceId
    }, { onConflict: "platform_account_id,external_id" }).select("id").single();
    if (postError || !post) throw new MetaCreatorInstagramCollectorError("Latest standalone Instagram media could not be persisted.");
    const { error } = await client.from("platform_metric_snapshots").upsert(
      snapshot(resolved.account, workspaceId, snapshotDate, collectedAt, { metric_name: "latest_reel_post_views", metric_unit: "views", metric_value: latestMediaViews, notes: mediaTitle(latestMedia) }, post.id),
      { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" }
    );
    if (error) throw new MetaCreatorInstagramCollectorError("Latest standalone Instagram metric could not be persisted.");
  }
  return { accountId: resolved.account.id, metrics: { followers: Number(account.followers_count), accountsReached30d: reach, views30d: views, latestMediaViews }, name: "standalone-instagram" as const, snapshotDate, status: "fulfilled" as const };
}

export async function hasEligibleMetaCreatorInstagramBinding(workspaceId: string, client: SupabaseClient) {
  try { await resolveAuthoritativeCreatorInstagram(client, workspaceId); return true; }
  catch (error) { if (error instanceof MetaCreatorInstagramCollectorError) return false; throw error; }
}

async function resolveAuthoritativeCreatorInstagram(client: SupabaseClient, workspaceId: string) {
  const { data: connections, error: connectionError } = await client.from("app_meta_connections").select("id, encrypted_token_payload, connection_state").eq("workspace_id", workspaceId).eq("connection_kind", "creator_social_instagram").eq("connection_state", "connected").limit(2);
  if (connectionError || connections?.length !== 1 || !connections[0].encrypted_token_payload) throw new MetaCreatorInstagramCollectorError("Exactly one connected standalone Instagram authorization is required.");
  const connection = connections[0] as Connection;
  const { data: mappings, error: mappingError } = await client.from("app_meta_connection_accounts").select("account_type, platform_account_id, is_selected, asset_state").eq("workspace_id", workspaceId).eq("connection_id", connection.id);
  const selected = (mappings as Mapping[] ?? []).filter((item) => item.account_type === "instagram_professional" && item.is_selected && item.asset_state === "selected");
  if (mappingError || selected.length !== 1) throw new MetaCreatorInstagramCollectorError("Exactly one selected standalone Instagram account is required.");
  const { data: accounts, error: accountError } = await client.from("platform_accounts").select("id, workspace_id, platform_id, meta_external_id, account_name, url").eq("workspace_id", workspaceId).eq("id", selected[0].platform_account_id).limit(2);
  if (accountError || accounts?.length !== 1 || !(accounts[0] as Account).meta_external_id) throw new MetaCreatorInstagramCollectorError("Canonical standalone Instagram account identity is unavailable.");
  const account = accounts[0] as Account;
  const { data: platform, error: platformError } = await client.from("platforms").select("slug").eq("id", account.platform_id).maybeSingle();
  if (platformError || platform?.slug !== "instagram") throw new MetaCreatorInstagramCollectorError("Selected standalone account is not an Instagram platform account.");
  return { account, connection };
}

function snapshot(account: Account, workspaceId: string, snapshotDate: string, importedAt: string, metric: { metric_name: string; metric_unit: string; metric_value: number; notes?: string }, contentPostId: string | null) {
  return { content_post_id: contentPostId, imported_at: importedAt, metric_name: metric.metric_name, metric_unit: metric.metric_unit, metric_value: metric.metric_value, notes: metric.notes ?? null, platform_account_id: account.id, platform_id: account.platform_id, snapshot_date: snapshotDate, source: creatorInstagramMetricSource, workspace_id: workspaceId };
}
async function instagramJson<T>(fetchImpl: FetchLike, path: string, token: string, parameters: Record<string, string>): Promise<T> { const url = new URL(`${graphHost}/${graphVersion}${path}`); url.searchParams.set("access_token", token); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value); const response = await fetchImpl(url, { cache: "no-store" }); let payload: T = {} as T; try { payload = await response.json() as T; } catch { /* safe generic error below */ } if (!response.ok) throw new MetaCreatorInstagramCollectorError(`Instagram Login API request failed safely (${response.status}).`); return payload; }
async function firstMediaInsights(fetchImpl: FetchLike, token: string, mediaId: string) { for (const metrics of ["views,reach", "plays,reach", "impressions,reach"]) { try { const payload = await instagramJson<{ data?: unknown[] }>(fetchImpl, `/${mediaId}/insights`, token, { metric: metrics }); const value = insightValue(payload.data, metrics.split(",")[0]); if (value !== null) return { value }; } catch (error) { if (!(error instanceof MetaCreatorInstagramCollectorError)) throw error; } } throw new MetaCreatorInstagramCollectorError("Latest standalone Instagram media response has no compatible view metric."); }
function insightValue(data: unknown[] | undefined, expected: string) { const insight = data?.find((item) => typeof item === "object" && item !== null && (item as { name?: unknown }).name === expected) ?? data?.[0]; if (!insight || typeof insight !== "object") return null; const record = insight as { total_value?: { value?: unknown }; values?: Array<{ value?: unknown }> }; if (finiteNumber(record.total_value?.value)) return Number(record.total_value!.value); if (Array.isArray(record.values)) { const values = record.values.map((item) => Number(item.value)); return values.length && values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null; } return null; }
function finiteNumber(value: unknown): value is number | string { return Number.isFinite(Number(value)); }
function latest(items: Media[]) { return items.slice().sort((a, b) => Date.parse(b.timestamp ?? "") - Date.parse(a.timestamp ?? ""))[0] ?? null; }
function mediaTitle(media: Media) { return media.caption?.split(/\r?\n/)[0]?.trim() || `${media.media_product_type ?? media.media_type ?? "Instagram media"} ${media.id}`; }

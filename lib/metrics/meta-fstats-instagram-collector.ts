import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptMetaTokenPayload } from "@/lib/meta/tokens";
import { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } from "@/lib/workspace-time";

const graphHost = "https://graph.facebook.com";
const graphVersion = "v23.0";

type FetchLike = typeof fetch;
type MetaAccount = { id: string; workspace_id: string; platform_id: string; meta_external_id: string | null; external_id: string | null; account_name: string; url: string | null };
type MetaMapping = { id: string; account_type: string; platform_account_id: string; parent_platform_account_id: string | null; is_selected: boolean; asset_state: string };
type MetaConnection = { id: string; encrypted_token_payload: string | null; connection_state: string };
type MetaBinding = { external_id: string; workspace_id: string; connection_id: string; mapping_id: string; parent_page_external_id: string };
type Media = { id: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; timestamp?: string };

export class MetaFstatsInstagramCollectorError extends Error {
  constructor(message: string) { super(message); this.name = "MetaFstatsInstagramCollectorError"; }
}

export type MetaFstatsInstagramCollectorResult = {
  accountId: string;
  diagnostics: Array<{ endpoint: string; metric: string; parameters: Record<string, string>; responseShape: string }>;
  metrics: { accountsReached30d: number; followers: number; latestMediaViews: number | null; views30d: number };
  name: "meta-fstats-instagram";
  snapshotDate: string;
  status: "fulfilled";
};

export async function refreshMetaFstatsInstagramMetrics(workspaceId: string, client: SupabaseClient, fetchImpl: FetchLike = fetch, now = new Date()): Promise<MetaFstatsInstagramCollectorResult> {
  const resolved = await resolveAuthoritativeInstagram(client, workspaceId);
  let token: string;
  try { token = decryptMetaTokenPayload(resolved.connection.encrypted_token_payload! ).accessToken; }
  catch { throw new MetaFstatsInstagramCollectorError("App B authorization could not be decrypted."); }

  const accountId = resolved.account.meta_external_id!;
  const until = Math.floor(now.getTime() / 1000);
  const since = until - 30 * 24 * 60 * 60;
  const accountParams = { fields: "id,username,name,followers_count" };
  const mediaParams = { fields: "id,caption,media_type,media_product_type,permalink,timestamp", limit: "10" };
  const insightParams = (metric: string) => ({ metric, metric_type: "total_value", period: "day", since: String(since), until: String(until) });

  const [account, mediaPayload, reachPayload, viewsPayload] = await Promise.all([
    graphJson<Record<string, unknown>>(fetchImpl, `/${accountId}`, token, accountParams),
    graphJson<{ data?: Media[] }>(fetchImpl, `/${accountId}/media`, token, mediaParams),
    graphJson<{ data?: unknown[] }>(fetchImpl, `/${accountId}/insights`, token, insightParams("reach")),
    graphJson<{ data?: unknown[] }>(fetchImpl, `/${accountId}/insights`, token, insightParams("views")),
  ]);
  if (account.id !== accountId || !finiteNumber(account.followers_count)) throw new MetaFstatsInstagramCollectorError("App B account response is missing a compatible follower count.");
  const reach = insightValue(reachPayload.data, "reach");
  const views = insightValue(viewsPayload.data, "views");
  if (reach === null || views === null) throw new MetaFstatsInstagramCollectorError("App B insights response is missing a compatible 30-day metric.");

  const latestMedia = latest(mediaPayload.data ?? []);
  let latestViews: number | null = null;
  const diagnostics: MetaFstatsInstagramCollectorResult["diagnostics"] = [
    diagnostic(`/${accountId}`, "followers", accountParams, account),
    diagnostic(`/${accountId}/insights`, "accounts_reached_30d", insightParams("reach"), reachPayload),
    diagnostic(`/${accountId}/insights`, "views_30d", insightParams("views"), viewsPayload),
  ];
  if (latestMedia) {
    const mediaInsight = await firstMediaInsights(fetchImpl, token, latestMedia.id);
    latestViews = mediaInsight.value;
    diagnostics.push(diagnostic(`/${latestMedia.id}/insights`, "latest_reel_post_views", { metric: mediaInsight.metricSet }, mediaInsight.payload));
  }

  const { data: setting, error: settingError } = await client.from("app_workspace_settings").select("timezone").eq("workspace_id", workspaceId).maybeSingle();
  if (settingError) throw new MetaFstatsInstagramCollectorError("Workspace snapshot date could not be resolved.");
  const snapshotDate = getWorkspaceDateKey(resolveTimeZone(setting?.timezone) ?? defaultWorkspaceTimeZone);
  const collectedAt = now.toISOString();
  const snapshots = [
    { metric_name: "followers", metric_unit: "count", metric_value: Number(account.followers_count) },
    { metric_name: "accounts_reached_30d", metric_unit: "count", metric_value: reach },
    { metric_name: "views_30d", metric_unit: "views", metric_value: views },
  ];
  for (const snapshot of snapshots) await persistSnapshot(client, workspaceId, resolved.account, snapshotDate, collectedAt, snapshot, null);
  if (latestMedia && latestViews !== null) {
    const { data: post, error: postError } = await client.from("content_posts").upsert({
      content_type: latestMedia.media_product_type === "REELS" ? "reel" : "post", external_id: latestMedia.id,
      platform_account_id: resolved.account.id, title: mediaTitle(latestMedia), url: latestMedia.permalink ?? null, workspace_id: workspaceId,
    }, { onConflict: "platform_account_id,external_id" }).select("id").single();
    if (postError || !post) throw new MetaFstatsInstagramCollectorError("Latest Instagram media could not be persisted.");
    await persistSnapshot(client, workspaceId, resolved.account, snapshotDate, collectedAt, { metric_name: "latest_reel_post_views", metric_unit: "views", metric_value: latestViews, notes: mediaTitle(latestMedia) }, post.id);
  }

  return { accountId: resolved.account.id, diagnostics, metrics: { followers: Number(account.followers_count), accountsReached30d: reach, views30d: views, latestMediaViews: latestViews }, name: "meta-fstats-instagram", snapshotDate, status: "fulfilled" };
}

// Shared orchestration uses this to skip unconfigured workspaces without ever
// consulting legacy global Instagram credentials.
export async function hasEligibleMetaFstatsInstagramBinding(workspaceId: string, client: SupabaseClient) {
  try {
    await resolveAuthoritativeInstagram(client, workspaceId);
    return true;
  } catch (error) {
    if (error instanceof MetaFstatsInstagramCollectorError) return false;
    throw error;
  }
}

async function resolveAuthoritativeInstagram(client: SupabaseClient, workspaceId: string) {
  const { data: connections, error: connectionError } = await client.from("app_meta_connections").select("id, encrypted_token_payload, connection_state").eq("workspace_id", workspaceId).eq("connection_kind", "fstats_login_facebook_page").limit(2);
  if (connectionError || connections?.length !== 1 || !connections[0].encrypted_token_payload) throw new MetaFstatsInstagramCollectorError("Exactly one authorized App B connection is required.");
  const connection = connections[0] as MetaConnection;
  const { data: mappings, error: mappingError } = await client.from("app_meta_connection_accounts").select("id, account_type, platform_account_id, parent_platform_account_id, is_selected, asset_state").eq("workspace_id", workspaceId).eq("connection_id", connection.id);
  if (mappingError) throw new MetaFstatsInstagramCollectorError("App B account mappings could not be read.");
  const selectedPages = (mappings as MetaMapping[] ?? []).filter((item) => item.account_type === "facebook_page" && item.is_selected && item.asset_state === "selected");
  const selectedInstagram = (mappings as MetaMapping[] ?? []).filter((item) => item.account_type === "instagram_professional" && item.is_selected && item.asset_state === "selected");
  if (selectedPages.length !== 1 || selectedInstagram.length !== 1 || selectedInstagram[0].parent_platform_account_id !== selectedPages[0].platform_account_id) throw new MetaFstatsInstagramCollectorError("Selected App B Page and Instagram mappings are inconsistent.");
  const ids = [selectedPages[0].platform_account_id, selectedInstagram[0].platform_account_id];
  const { data: accounts, error: accountError } = await client.from("platform_accounts").select("id, workspace_id, platform_id, meta_external_id, external_id, account_name, url").in("id", ids).eq("workspace_id", workspaceId);
  if (accountError || accounts?.length !== 2) throw new MetaFstatsInstagramCollectorError("Canonical App B platform accounts are unavailable.");
  const account = (accounts as MetaAccount[]).find((item) => item.id === selectedInstagram[0].platform_account_id);
  const page = (accounts as MetaAccount[]).find((item) => item.id === selectedPages[0].platform_account_id);
  if (!account?.meta_external_id || !page?.meta_external_id) throw new MetaFstatsInstagramCollectorError("Canonical App B account identity is missing.");
  const { data: platform, error: platformError } = await client.from("platforms").select("slug").eq("id", account.platform_id).maybeSingle();
  if (platformError || platform?.slug !== "instagram") throw new MetaFstatsInstagramCollectorError("Selected App B account is not an Instagram platform account.");
  const { data: bindings, error: bindingError } = await client.from("app_meta_active_instagram_bindings").select("external_id, workspace_id, connection_id, mapping_id, parent_page_external_id").eq("external_id", account.meta_external_id).limit(2);
  if (bindingError || bindings?.length !== 1) throw new MetaFstatsInstagramCollectorError("Active App B Instagram binding is unavailable.");
  const binding = bindings[0] as MetaBinding;
  if (binding.workspace_id !== workspaceId || binding.connection_id !== connection.id || binding.mapping_id !== selectedInstagram[0].id || binding.parent_page_external_id !== page.meta_external_id) throw new MetaFstatsInstagramCollectorError("Active App B Instagram binding is inconsistent.");
  return { account, connection };
}

async function persistSnapshot(client: SupabaseClient, workspaceId: string, account: MetaAccount, snapshotDate: string, collectedAt: string, metric: { metric_name: string; metric_unit: string; metric_value: number; notes?: string }, contentPostId: string | null) {
  const { error } = await client.from("platform_metric_snapshots").upsert({ content_post_id: contentPostId, imported_at: collectedAt, metric_name: metric.metric_name, metric_unit: metric.metric_unit, metric_value: metric.metric_value, notes: metric.notes ?? null, platform_account_id: account.id, platform_id: account.platform_id, snapshot_date: snapshotDate, source: "instagram-api", workspace_id: workspaceId }, { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" });
  if (error) throw new MetaFstatsInstagramCollectorError(`Instagram metric ${metric.metric_name} could not be persisted.`);
}

async function graphJson<T>(fetchImpl: FetchLike, path: string, token: string, parameters: Record<string, string>): Promise<T> {
  const url = new URL(`${graphHost}/${graphVersion}${path}`); url.searchParams.set("access_token", token); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetchImpl(url, { cache: "no-store" });
  let payload: T = {} as T; try { payload = await response.json() as T; } catch { /* safe generic error below */ }
  if (!response.ok) throw new MetaFstatsInstagramCollectorError(`Meta Graph request failed safely (${response.status}).`);
  return payload;
}

async function firstMediaInsights(fetchImpl: FetchLike, token: string, mediaId: string) {
  for (const metrics of ["views,reach", "plays,reach", "impressions,reach"]) {
    try { const payload = await graphJson<{ data?: unknown[] }>(fetchImpl, `/${mediaId}/insights`, token, { metric: metrics }); const value = insightValue(payload.data, metrics.split(",")[0]); if (value !== null) return { metricSet: metrics, payload, value }; }
    catch (error) { if (!(error instanceof MetaFstatsInstagramCollectorError)) throw error; }
  }
  throw new MetaFstatsInstagramCollectorError("Latest Instagram media response has no compatible view metric.");
}

function insightValue(data: unknown[] | undefined, expected: string) { const insight = data?.find((item) => typeof item === "object" && item !== null && (item as { name?: unknown }).name === expected) ?? data?.[0]; if (!insight || typeof insight !== "object") return null; const record = insight as { total_value?: { value?: unknown }; values?: Array<{ value?: unknown }> }; if (finiteNumber(record.total_value?.value)) return Number(record.total_value!.value); if (Array.isArray(record.values)) { const values = record.values.map((item) => Number(item.value)); return values.length && values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null; } return null; }
function finiteNumber(value: unknown): value is number | string { return Number.isFinite(Number(value)); }
function latest(items: Media[]) { return items.slice().sort((a, b) => Date.parse(b.timestamp ?? "") - Date.parse(a.timestamp ?? ""))[0] ?? null; }
function mediaTitle(media: Media) { return media.caption?.split(/\r?\n/)[0]?.trim() || `${media.media_product_type ?? media.media_type ?? "Instagram media"} ${media.id}`; }
function diagnostic(endpoint: string, metric: string, parameters: Record<string, string>, payload: unknown) { return { endpoint, metric, parameters, responseShape: Array.isArray((payload as { data?: unknown }).data) ? "data[]" : typeof payload === "object" && payload !== null ? "object" : typeof payload }; }

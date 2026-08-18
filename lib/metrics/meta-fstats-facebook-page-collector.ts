import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptMetaTokenPayload } from "@/lib/meta/tokens";
import { defaultWorkspaceTimeZone, resolveTimeZone } from "@/lib/workspace-time";

const graphHost = "https://graph.facebook.com";
const graphVersion = "v23.0";
const source = "meta-fstats-facebook-page-api";

type FetchLike = typeof fetch;
type MetaAccount = { id: string; workspace_id: string; platform_id: string; meta_external_id: string | null; external_id: string | null };
type MetaConnection = { id: string; encrypted_token_payload: string | null; connection_state: string };
type MetaMapping = { id: string; account_type: string; platform_account_id: string; is_selected: boolean; asset_state: string };
type DailyPoint = { end_time?: unknown; value?: unknown };

export class MetaFstatsFacebookPageCollectorError extends Error {
  constructor(message: string) { super(message); this.name = "MetaFstatsFacebookPageCollectorError"; }
}

export type MetaFstatsFacebookPageCollectorResult = {
  accountId: string;
  metrics: { followers: number; postEngagementsDaily: number; postReactionsDaily: number };
  name: "facebook";
  snapshotDates: { followers: string; postEngagementsDaily: string; postReactionsDaily: string };
  status: "fulfilled";
};

export async function refreshMetaFstatsFacebookPageMetrics(workspaceId: string, client: SupabaseClient, fetchImpl: FetchLike = fetch, now = new Date()): Promise<MetaFstatsFacebookPageCollectorResult> {
  const resolved = await resolveAuthoritativeFacebookPage(client, workspaceId);
  let userToken: string;
  try { userToken = decryptMetaTokenPayload(resolved.connection.encrypted_token_payload!).accessToken; }
  catch { throw new MetaFstatsFacebookPageCollectorError("App B authorization could not be decrypted."); }

  const pageTokenPayload = await graphJson<{ data?: Array<{ id?: unknown; access_token?: unknown }> }>(fetchImpl, "/me/accounts", userToken, { fields: "id,name,access_token", limit: "100" });
  const matchingPages = (pageTokenPayload.data ?? []).filter((item) => item.id === resolved.pageId && typeof item.access_token === "string" && item.access_token);
  if (matchingPages.length !== 1) throw new MetaFstatsFacebookPageCollectorError("Selected Facebook Page is unavailable to the current App B authorization.");
  const pageToken = matchingPages[0].access_token as string;
  const until = Math.floor(now.getTime() / 1000);
  const since = until - 8 * 24 * 60 * 60;
  const dailyParams = (metric: string) => ({ metric, period: "day", since: String(since), until: String(until) });
  const [page, engagements, reactions, setting] = await Promise.all([
    graphJson<{ id?: unknown; followers_count?: unknown }>(fetchImpl, `/${resolved.pageId}`, pageToken, { fields: "id,followers_count" }),
    graphJson<{ data?: Array<{ name?: unknown; values?: DailyPoint[] }> }>(fetchImpl, `/${resolved.pageId}/insights`, pageToken, dailyParams("page_post_engagements")),
    graphJson<{ data?: Array<{ name?: unknown; values?: DailyPoint[] }> }>(fetchImpl, `/${resolved.pageId}/insights`, pageToken, dailyParams("page_actions_post_reactions_total")),
    client.from("app_workspace_settings").select("timezone").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (setting.error) throw new MetaFstatsFacebookPageCollectorError("Workspace snapshot date could not be resolved.");
  if (page.id !== resolved.pageId || !finiteNumber(page.followers_count)) throw new MetaFstatsFacebookPageCollectorError("Facebook Page response is missing a compatible follower count.");
  const timeZone = resolveTimeZone(setting.data?.timezone) ?? defaultWorkspaceTimeZone;
  const engagementPoint = latestCompletedPoint(engagements.data, "page_post_engagements", now);
  const reactionPoint = latestCompletedPoint(reactions.data, "page_actions_post_reactions_total", now);
  const postEngagementsDaily = scalarValue(engagementPoint.value);
  const postReactionsDaily = reactionTotal(reactionPoint.value);
  if (postEngagementsDaily === null || postReactionsDaily === null) throw new MetaFstatsFacebookPageCollectorError("Facebook Page insights response is missing a compatible completed daily metric.");

  const collectedAt = now.toISOString();
  const snapshots = [
    snapshot(resolved, workspaceId, workspaceDateKey(now, timeZone), "followers", Number(page.followers_count), collectedAt),
    snapshot(resolved, workspaceId, workspaceDateKey(engagementPoint.endTime, timeZone), "post_engagements_daily", postEngagementsDaily, collectedAt),
    snapshot(resolved, workspaceId, workspaceDateKey(reactionPoint.endTime, timeZone), "post_reactions_daily", postReactionsDaily, collectedAt),
  ];
  // One PostgREST upsert request maps to one PostgreSQL statement, so required
  // metric persistence is all-or-nothing after all responses are validated.
  const { error } = await client.from("platform_metric_snapshots").upsert(snapshots, { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" });
  if (error) throw new MetaFstatsFacebookPageCollectorError("Facebook Page metrics could not be persisted.");
  return { accountId: resolved.account.id, metrics: { followers: Number(page.followers_count), postEngagementsDaily, postReactionsDaily }, name: "facebook", snapshotDates: { followers: snapshots[0].snapshot_date, postEngagementsDaily: snapshots[1].snapshot_date, postReactionsDaily: snapshots[2].snapshot_date }, status: "fulfilled" };
}

export async function hasEligibleMetaFstatsFacebookPageBinding(workspaceId: string, client: SupabaseClient) {
  try { await resolveAuthoritativeFacebookPage(client, workspaceId); return true; }
  catch (error) { if (error instanceof MetaFstatsFacebookPageCollectorError) return false; throw error; }
}

async function resolveAuthoritativeFacebookPage(client: SupabaseClient, workspaceId: string) {
  const { data: connections, error: connectionError } = await client.from("app_meta_connections").select("id, encrypted_token_payload, connection_state").eq("workspace_id", workspaceId).eq("connection_kind", "fstats_login_facebook_page").limit(2);
  if (connectionError || connections?.length !== 1 || !connections[0].encrypted_token_payload || connections[0].connection_state !== "connected") throw new MetaFstatsFacebookPageCollectorError("Exactly one connected App B authorization is required.");
  const connection = connections[0] as MetaConnection;
  const { data: mappings, error: mappingError } = await client.from("app_meta_connection_accounts").select("id, account_type, platform_account_id, is_selected, asset_state").eq("workspace_id", workspaceId).eq("connection_id", connection.id);
  if (mappingError) throw new MetaFstatsFacebookPageCollectorError("App B Page mappings could not be read.");
  const selected = (mappings as MetaMapping[] ?? []).filter((item) => item.account_type === "facebook_page" && item.is_selected && item.asset_state === "selected");
  if (selected.length !== 1) throw new MetaFstatsFacebookPageCollectorError("Exactly one selected Facebook Page is required.");
  const { data: accounts, error: accountError } = await client.from("platform_accounts").select("id, workspace_id, platform_id, meta_external_id, external_id").eq("workspace_id", workspaceId).eq("id", selected[0].platform_account_id).limit(2);
  if (accountError || accounts?.length !== 1) throw new MetaFstatsFacebookPageCollectorError("Canonical Facebook Page account is unavailable.");
  const account = accounts[0] as MetaAccount;
  const pageId = account.meta_external_id ?? account.external_id;
  if (!pageId) throw new MetaFstatsFacebookPageCollectorError("Canonical Facebook Page identity is missing.");
  const { data: platform, error: platformError } = await client.from("platforms").select("slug").eq("id", account.platform_id).maybeSingle();
  if (platformError || platform?.slug !== "facebook") throw new MetaFstatsFacebookPageCollectorError("Selected App B account is not a Facebook Page.");
  return { account, connection, pageId };
}

function snapshot(resolved: { account: MetaAccount }, workspaceId: string, snapshotDate: string, metricName: string, metricValue: number, collectedAt: string) {
  return { content_post_id: null, imported_at: collectedAt, metric_name: metricName, metric_unit: "count", metric_value: metricValue, notes: null, platform_account_id: resolved.account.id, platform_id: resolved.account.platform_id, snapshot_date: snapshotDate, source, workspace_id: workspaceId };
}

async function graphJson<T>(fetchImpl: FetchLike, path: string, token: string, parameters: Record<string, string>): Promise<T> {
  const url = new URL(`${graphHost}/${graphVersion}${path}`); url.searchParams.set("access_token", token); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetchImpl(url, { cache: "no-store" });
  let payload: T = {} as T; try { payload = await response.json() as T; } catch { /* safe generic error below */ }
  if (!response.ok) throw new MetaFstatsFacebookPageCollectorError(`Meta Graph request failed safely (${response.status}).`);
  return payload;
}

function latestCompletedPoint(data: Array<{ name?: unknown; values?: DailyPoint[] }> | undefined, metric: string, now: Date) {
  const insight = data?.find((item) => item.name === metric) ?? data?.[0];
  const points = insight?.values?.map((item) => ({ endTime: new Date(String(item.end_time ?? "")), value: item.value })).filter((item) => !Number.isNaN(item.endTime.getTime()) && item.endTime.getTime() <= now.getTime()) ?? [];
  const point = points.sort((first, second) => second.endTime.getTime() - first.endTime.getTime())[0];
  if (!point) throw new MetaFstatsFacebookPageCollectorError("Facebook Page insights response has no completed daily interval.");
  return point;
}

function scalarValue(value: unknown) { return finiteNumber(value) ? Number(value) : null; }
function reactionTotal(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const values = Object.values(value).map(Number); return values.every(Number.isFinite) ? values.reduce((total, item) => total + item, 0) : null; }
function finiteNumber(value: unknown): value is number | string { return Number.isFinite(Number(value)); }
function workspaceDateKey(date: Date, timeZone: string) { const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone, year: "numeric" }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptMetaTokenPayload } from "@/lib/meta/tokens";
import { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } from "@/lib/workspace-time";

const graphHost = "https://graph.threads.net";
const graphVersion = "v1.0";
export const creatorThreadsMetricSource = "threads-api";
const insightMetrics = ["views", "likes", "replies", "reposts", "quotes", "clicks", "followers_count"] as const;

type FetchLike = typeof fetch;
type Account = { id: string; workspace_id: string; platform_id: string; meta_external_id: string | null };
type Connection = { id: string; encrypted_token_payload: string | null };
type Mapping = { account_type: string; platform_account_id: string; is_selected: boolean; asset_state: string };
type Insight = { name?: unknown; values?: Array<{ value?: unknown; end_time?: unknown }> };

export class MetaCreatorThreadsCollectorError extends Error {
  constructor(message: string) { super(message); this.name = "MetaCreatorThreadsCollectorError"; }
}

export async function refreshMetaCreatorThreadsMetrics(workspaceId: string, client: SupabaseClient, fetchImpl: FetchLike = fetch, now = new Date()) {
  const resolved = await resolveAuthoritativeCreatorThreads(client, workspaceId);
  let token: string;
  try { token = decryptMetaTokenPayload(resolved.connection.encrypted_token_payload!).accessToken; }
  catch { throw new MetaCreatorThreadsCollectorError("Threads authorization could not be decrypted."); }
  const [profile, insightsPayload, settings] = await Promise.all([
    threadsJson<Record<string, unknown>>(fetchImpl, "/me", token, { fields: "id,username,threads_profile_picture_url" }),
    threadsJson<{ data?: Insight[] }>(fetchImpl, "/me/threads_insights", token, { metric: insightMetrics.join(",") }),
    client.from("app_workspace_settings").select("timezone").eq("workspace_id", workspaceId).maybeSingle()
  ]);
  if (settings.error) throw new MetaCreatorThreadsCollectorError("Workspace snapshot date could not be resolved.");
  if (profile.id !== resolved.account.meta_external_id) throw new MetaCreatorThreadsCollectorError("Threads profile response does not match the canonical provider identity.");
  const snapshotDate = getWorkspaceDateKey(resolveTimeZone(settings.data?.timezone) ?? defaultWorkspaceTimeZone);
  const collectedAt = now.toISOString();
  const metrics = insightMetrics.flatMap((name) => {
    const value = latestInsightValue(insightsPayload.data, name, now);
    return value === null ? [] : [{ metric_name: threadsMetricName(name), metric_unit: name === "followers_count" ? "count" : name === "views" ? "views" : "count", metric_value: value }];
  });
  if (metrics.length) {
    const { error } = await client.from("platform_metric_snapshots").upsert(metrics.map((metric) => ({ content_post_id: null, imported_at: collectedAt, ...metric, notes: null, platform_account_id: resolved.account.id, platform_id: resolved.account.platform_id, snapshot_date: snapshotDate, source: creatorThreadsMetricSource, workspace_id: workspaceId })), { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" });
    if (error) throw new MetaCreatorThreadsCollectorError("Threads metrics could not be persisted.");
  }
  return { accountId: resolved.account.id, metrics: Object.fromEntries(metrics.map((metric) => [metric.metric_name, metric.metric_value])), name: "threads" as const, snapshotDate, status: "fulfilled" as const };
}

export async function hasEligibleMetaCreatorThreadsBinding(workspaceId: string, client: SupabaseClient) {
  try { await resolveAuthoritativeCreatorThreads(client, workspaceId); return true; }
  catch (error) { if (error instanceof MetaCreatorThreadsCollectorError) return false; throw error; }
}

async function resolveAuthoritativeCreatorThreads(client: SupabaseClient, workspaceId: string) {
  const { data: connections, error: connectionError } = await client.from("app_meta_connections").select("id, encrypted_token_payload").eq("workspace_id", workspaceId).eq("connection_kind", "creator_social_threads").eq("connection_state", "connected").limit(2);
  if (connectionError || connections?.length !== 1 || !connections[0].encrypted_token_payload) throw new MetaCreatorThreadsCollectorError("Exactly one connected Threads authorization is required.");
  const connection = connections[0] as Connection;
  const { data: mappings, error: mappingError } = await client.from("app_meta_connection_accounts").select("account_type, platform_account_id, is_selected, asset_state").eq("workspace_id", workspaceId).eq("connection_id", connection.id);
  const selected = (mappings as Mapping[] ?? []).filter((item) => item.account_type === "threads_profile" && item.is_selected && item.asset_state === "selected");
  if (mappingError || selected.length !== 1) throw new MetaCreatorThreadsCollectorError("Exactly one selected Threads profile is required.");
  const { data: accounts, error: accountError } = await client.from("platform_accounts").select("id, workspace_id, platform_id, meta_external_id").eq("workspace_id", workspaceId).eq("id", selected[0].platform_account_id).limit(2);
  if (accountError || accounts?.length !== 1 || !(accounts[0] as Account).meta_external_id) throw new MetaCreatorThreadsCollectorError("Canonical Threads profile identity is unavailable.");
  const account = accounts[0] as Account;
  const { data: platform, error: platformError } = await client.from("platforms").select("slug").eq("id", account.platform_id).maybeSingle();
  if (platformError || platform?.slug !== "threads") throw new MetaCreatorThreadsCollectorError("Selected account is not a Threads platform account.");
  return { account, connection };
}

function threadsMetricName(name: typeof insightMetrics[number]) { return name === "followers_count" ? "followers" : `${name}_daily`; }
function latestInsightValue(data: Insight[] | undefined, name: string, now: Date) { const values = data?.find((insight) => insight.name === name)?.values ?? []; const dated = values.map((point) => ({ date: new Date(String(point.end_time ?? "")), value: Number(point.value) })).filter((point) => !Number.isNaN(point.date.getTime()) && point.date.getTime() <= now.getTime() && Number.isFinite(point.value)).sort((a, b) => b.date.getTime() - a.date.getTime())[0]; return dated?.value ?? null; }
async function threadsJson<T>(fetchImpl: FetchLike, path: string, token: string, parameters: Record<string, string>): Promise<T> { const url = new URL(`${graphHost}/${graphVersion}${path}`); url.searchParams.set("access_token", token); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value); const response = await fetchImpl(url, { cache: "no-store" }); let payload: T = {} as T; try { payload = await response.json() as T; } catch { /* safe generic error below */ } if (!response.ok) throw new MetaCreatorThreadsCollectorError(`Threads API request failed safely (${response.status}).`); return payload; }

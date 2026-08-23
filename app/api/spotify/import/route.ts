import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";
import { selectSpotifyAudienceHistory, type SpotifyAudienceHistoryRow } from "@/lib/spotify-audience-history";

type AudienceRow = SpotifyAudienceHistoryRow;
type SongRow = { listeners: number; releaseDate: string; saves: number; song: string; streams: number };
type PlaylistRow = { listeners: number; streams: number; title: string };
type Payload = { audienceRows?: AudienceRow[]; fileName?: string; playlistsRows?: PlaylistRow[]; songsRows?: SongRow[] };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourceAudience = "spotify-audience-csv";
const sourceSongs = "spotify-songs-csv";
const sourcePlaylists = "spotify-playlists-csv";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const payload = (await request.json()) as Payload;
  const error = validate(payload);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const result = await importSpotify(payload, workspaceId);
    return NextResponse.json({ ...result, status: "ok" });
  } catch (cause) {
    return NextResponse.json({ error: getErrorMessage(cause) }, { status: 500 });
  }
}

async function importSpotify(payload: Payload, workspaceId: string) {
  const supabase = serviceClient();
  const { data: platform, error: platformError } = await supabase.from("platforms").upsert({ category: "streaming", name: "Spotify", slug: "spotify" }, { onConflict: "slug" }).select("id").single();
  if (platformError) throw platformError;
  const { data: account, error: accountError } = await supabase.from("platform_accounts").upsert({ account_name: "Spotify for Artists CSV", external_id: "spotify-for-artists-csv", platform_id: platform.id, url: "https://artists.spotify.com/", workspace_id: workspaceId }, { onConflict: "workspace_id,platform_id,account_name" }).select("id").single();
  if (accountError) throw accountError;

  const rows: Array<Record<string, unknown>> = [];
  let authoritativeDate = "";
  let kind = "";
  if (payload.audienceRows) {
    kind = "Audience Timeline";
    const monthly = selectSpotifyAudienceHistory(payload.audienceRows);
    authoritativeDate = payload.audienceRows.at(-1)!.date;
    const latest = payload.audienceRows.at(-1)!;
    const { data: existingDates, error: existingDatesError } = await supabase.from("platform_metric_snapshots").select("notes").eq("workspace_id", workspaceId).eq("platform_id", platform.id).eq("platform_account_id", account.id).eq("source", "spotify-audience-current-csv").eq("metric_name", "audience_data_date");
    if (existingDatesError) throw existingDatesError;
    const existingDate = (existingDates ?? []).map((row) => row.notes ?? "").filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort((a, b) => b.localeCompare(a))[0];
    const historyStartDate = monthly[0]?.date;
    if (historyStartDate) {
      // Remove any pre-meaningful rows written by the former zero-padded import
      // behavior. Repeating the same lifetime export cannot restore them.
      const { error: cleanupError } = await supabase.from("platform_metric_snapshots").delete().eq("workspace_id", workspaceId).eq("platform_id", platform.id).eq("platform_account_id", account.id).eq("source", sourceAudience).lt("snapshot_date", historyStartDate);
      if (cleanupError) throw cleanupError;
    }
    if (existingDate && authoritativeDate <= existingDate) {
      const { error: logError } = await supabase.from("import_logs").insert({ finished_at: new Date().toISOString(), import_status: "completed", records_inserted: 0, records_seen: payload.audienceRows.length, source: sourceAudience, source_file: payload.fileName ?? "Spotify CSV", workspace_id: workspaceId });
      if (logError) throw logError;
      return { authoritativeDate: existingDate, kind, noNewData: true, records: 0 };
    }
    const dates = monthly.map((row) => row.date);
    // A re-upload replaces this source's selected monthly observations for the same months.
    for (const date of dates) {
      const monthStart = `${date.slice(0, 7)}-01`;
      const monthEnd = getMonthEndDate(date);
      const { error } = await supabase.from("platform_metric_snapshots").delete().eq("workspace_id", workspaceId).eq("platform_id", platform.id).eq("platform_account_id", account.id).eq("source", sourceAudience).gte("snapshot_date", monthStart).lte("snapshot_date", monthEnd);
      if (error) throw error;
    }
    for (const row of monthly) for (const [metric_name, metric_value] of Object.entries({ followers: row.followers, listeners: row.listeners, monthly_active_listeners: row.monthlyActiveListeners, monthly_listeners: row.monthlyListeners, playlist_adds: row.playlistAdds, saves: row.saves, streams: row.streams, super_listeners: row.superListeners })) rows.push(metric(workspaceId, platform.id, account.id, row.date, sourceAudience, metric_name, metric_value));
    rows.push(metric(workspaceId, platform.id, account.id, latest.date, "spotify-audience-current-csv", "followers", latest.followers));
    rows.push(metric(workspaceId, platform.id, account.id, latest.date, "spotify-audience-current-csv", "monthly_active_listeners", latest.monthlyActiveListeners));
    rows.push(metric(workspaceId, platform.id, account.id, latest.date, "spotify-audience-current-csv", "audience_data_date", 0, latest.date));
  }
  if (payload.songsRows) {
    kind = "Songs";
    const latestReleaseDate = payload.songsRows.map((row) => row.releaseDate).sort().at(-1)!;
    authoritativeDate = "";
    const totalStreams = payload.songsRows.reduce((sum, row) => sum + row.streams, 0);
    const latest = payload.songsRows.filter((row) => row.releaseDate === latestReleaseDate).sort((a, b) => b.streams - a.streams)[0];
    const snapshotDate = new Date().toISOString().slice(0, 10);
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourceSongs, "total_catalog_streams", totalStreams));
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourceSongs, "latest_release_streams", latest.streams, latest.song));
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourceSongs, "latest_release_name", 0, latest.song));
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourceSongs, "latest_release_date", 0, latestReleaseDate));
  }
  if (payload.playlistsRows) {
    kind = "Playlists";
    const snapshotDate = new Date().toISOString().slice(0, 10);
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourcePlaylists, "all_playlists_listeners", payload.playlistsRows.reduce((sum, row) => sum + row.listeners, 0)));
    rows.push(metric(workspaceId, platform.id, account.id, snapshotDate, sourcePlaylists, "all_playlists_streams", payload.playlistsRows.reduce((sum, row) => sum + row.streams, 0)));
  }
  const { error: writeError } = await supabase.from("platform_metric_snapshots").upsert(rows, { onConflict: "workspace_id,snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source" });
  if (writeError) throw writeError;
  const source = payload.audienceRows ? sourceAudience : payload.songsRows ? sourceSongs : sourcePlaylists;
  const { error: logError } = await supabase.from("import_logs").insert({ finished_at: new Date().toISOString(), import_status: "completed", records_inserted: rows.length, records_seen: payload.audienceRows?.length ?? payload.songsRows?.length ?? payload.playlistsRows?.length ?? 0, source, source_file: payload.fileName ?? "Spotify CSV", workspace_id: workspaceId });
  if (logError) throw logError;
  const { data: importSources, error: importSourcesError } = await supabase.from("import_logs").select("source").eq("workspace_id", workspaceId).eq("import_status", "completed").in("source", [sourceAudience, sourceSongs, sourcePlaylists]);
  if (importSourcesError) throw importSourcesError;
  return { authoritativeDate, kind, noNewData: false, records: rows.length, sources: [...new Set((importSources ?? []).map((row) => row.source))] };
}

function metric(workspace_id: string, platform_id: string, platform_account_id: string, snapshot_date: string, source: string, metric_name: string, metric_value: number, notes: string | null = null) { return { metric_name, metric_unit: metric_name.includes("date") ? "date" : "count", metric_value, notes, platform_account_id, platform_id, snapshot_date, source, workspace_id }; }
function getMonthEndDate(date: string) { const [year, month] = date.slice(0, 7).split("-").map(Number); return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); }
function validDate(value: string) { const parsed = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }
function validate(payload: Payload) {
  if ([payload.audienceRows, payload.songsRows, payload.playlistsRows].filter(Boolean).length !== 1) return "Choose one valid Spotify Audience Timeline, Songs, or Playlists CSV.";
  const audience = payload.audienceRows;
  if (audience) { if (!audience.length) return "Spotify Audience Timeline has no data rows."; for (const row of audience) if (!validDate(row.date) || Object.values(row).some((value) => typeof value === "number" && (!Number.isFinite(value) || value < 0))) return "Spotify Audience Timeline contains an invalid date or number."; if (audience.some((row, index) => index > 0 && row.date <= audience[index - 1].date)) return "Spotify Audience Timeline dates must be strictly ascending."; return null; }
  if (payload.playlistsRows) { if (!payload.playlistsRows.length) return "Spotify Playlists CSV has no data rows."; for (const row of payload.playlistsRows) if (!row.title.trim() || [row.listeners, row.streams].some((value) => !Number.isFinite(value) || value < 0)) return "Spotify Playlists CSV contains an invalid title or number."; return null; }
  const songs = payload.songsRows!;
  if (!songs.length) return "Spotify Songs CSV has no data rows.";
  for (const row of songs) if (!row.song.trim() || !validDate(row.releaseDate) || [row.listeners, row.saves, row.streams].some((value) => !Number.isFinite(value) || value < 0)) return "Spotify Songs CSV contains an invalid song, release date, or number.";
  return null;
}
function isAuthorized(request: NextRequest) { if (request.headers.get("x-love-strings-import") !== "spotify-csv") return false; const origin = request.headers.get("origin"); const host = request.headers.get("host"); return Boolean(origin && host && new URL(origin).host === host); }
function serviceClient() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase server configuration."); return createClient(supabaseUrl, supabaseServiceRoleKey); }
function getErrorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") return cause.message;
  return "Spotify CSV import failed.";
}

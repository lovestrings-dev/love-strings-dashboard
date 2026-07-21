import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AppleMusicCsvRow = {
  avgDailyListeners: number;
  plays: number;
  purchases: number;
  radioSpins: number;
  shazams: number;
  song: string;
};

type AppleMusicImportPayload = {
  currentReleaseName?: string;
  fileName?: string;
  reportEndDate: string;
  reportStartDate?: string;
  rows: AppleMusicCsvRow[];
};
type AppleMusicMetricRow = {
  metric_name: string;
  metric_unit: string;
  metric_value: number;
  notes: string;
  song_id?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!isAuthorizedAppleImportRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as AppleMusicImportPayload;
  const validationError = validateAppleMusicImportPayload(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const result = await importAppleMusicCsvMetrics(payload);
  return NextResponse.json({ ...result, status: "ok" });
}

async function importAppleMusicCsvMetrics(payload: AppleMusicImportPayload) {
  const supabase = createServiceSupabaseClient();
  const fileName = payload.fileName ?? "Apple Music CSV";
  const source = "apple-music-csv";
  const accountName = "Love Strings Apple Music";
  const currentReleaseName = await resolveCurrentReleaseName(supabase, payload);
  const currentReleaseRow =
    payload.rows.find(
      (row) => row.song.toLowerCase() === currentReleaseName.toLowerCase()
    ) ?? payload.rows[0];

  const { data: platform, error: platformError } = await supabase
    .from("platforms")
    .upsert(
      { category: "streaming", name: "Apple Music", slug: "apple-music" },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (platformError) throw platformError;

  const { data: account, error: accountError } = await supabase
    .from("platform_accounts")
    .upsert(
      {
        account_name: accountName,
        external_id: "apple-music-for-artists-csv",
        platform_id: platform.id,
        url: "https://artists.apple.com/"
      },
      { onConflict: "platform_id,account_name" }
    )
    .select("id")
    .single();

  if (accountError) throw accountError;

  const songIdsByTitle = new Map<string, string>();

  for (const row of payload.rows) {
    const song = await findOrCreateSong(supabase, row.song);
    songIdsByTitle.set(song.title.toLowerCase(), song.id);
  }

  const totalPlays = payload.rows.reduce((total, row) => total + row.plays, 0);
  const totalShazams = payload.rows.reduce((total, row) => total + row.shazams, 0);
  const totalRadioSpins = payload.rows.reduce((total, row) => total + row.radioSpins, 0);
  const totalPurchases = payload.rows.reduce((total, row) => total + row.purchases, 0);
  const averageDailyListeners = payload.rows.reduce(
    (total, row) => total + row.avgDailyListeners,
    0
  );
  const importedRows: AppleMusicMetricRow[] = [
    {
      metric_name: "report_start_date",
      metric_unit: "date",
      metric_value: 0,
      notes: payload.reportStartDate ?? payload.reportEndDate
    },
    {
      metric_name: "report_end_date",
      metric_unit: "date",
      metric_value: 0,
      notes: payload.reportEndDate
    },
    {
      metric_name: "last_update_date",
      metric_unit: "date",
      metric_value: 0,
      notes: formatDateForDisplay(payload.reportEndDate)
    },
    {
      metric_name: "total_plays",
      metric_unit: "plays",
      metric_value: totalPlays,
      notes: fileName
    },
    {
      metric_name: "total_shazams",
      metric_unit: "shazams",
      metric_value: totalShazams,
      notes: fileName
    },
    {
      metric_name: "total_radio_spins",
      metric_unit: "spins",
      metric_value: totalRadioSpins,
      notes: fileName
    },
    {
      metric_name: "total_purchases",
      metric_unit: "purchases",
      metric_value: totalPurchases,
      notes: fileName
    },
    {
      metric_name: "avg_daily_listeners",
      metric_unit: "listeners",
      metric_value: averageDailyListeners,
      notes: fileName
    },
    {
      metric_name: "current_release_name",
      metric_unit: "text",
      metric_value: 0,
      notes: currentReleaseRow.song
    },
    {
      metric_name: "current_release_plays",
      metric_unit: "plays",
      metric_value: currentReleaseRow.plays,
      notes: currentReleaseRow.song
    },
    {
      metric_name: "current_release_shazams",
      metric_unit: "shazams",
      metric_value: currentReleaseRow.shazams,
      notes: currentReleaseRow.song
    }
  ];

  for (const row of payload.rows) {
    const songId = songIdsByTitle.get(row.song.toLowerCase());
    importedRows.push(
      {
        metric_name: "song_plays",
        metric_unit: "plays",
        metric_value: row.plays,
        notes: row.song,
        song_id: songId
      },
      {
        metric_name: "song_avg_daily_listeners",
        metric_unit: "listeners",
        metric_value: row.avgDailyListeners,
        notes: row.song,
        song_id: songId
      },
      {
        metric_name: "song_shazam_count",
        metric_unit: "shazams",
        metric_value: row.shazams,
        notes: row.song,
        song_id: songId
      },
      {
        metric_name: "song_radio_spins",
        metric_unit: "spins",
        metric_value: row.radioSpins,
        notes: row.song,
        song_id: songId
      },
      {
        metric_name: "song_purchases",
        metric_unit: "purchases",
        metric_value: row.purchases,
        notes: row.song,
        song_id: songId
      }
    );
  }

  for (const row of importedRows) {
    const { error } = await supabase
      .from("platform_metric_snapshots")
      .upsert(
        {
          metric_name: row.metric_name,
          metric_unit: row.metric_unit,
          metric_value: row.metric_value,
          notes: row.notes,
          platform_account_id: account.id,
          platform_id: platform.id,
          snapshot_date: payload.reportEndDate,
          song_id: row.song_id ?? null,
          source
        },
        {
          onConflict:
            "snapshot_date,platform_id,platform_account_id,content_post_id,song_id,release_id,metric_name,source"
        }
      );

    if (error) throw error;
  }

  const { error: logError } = await supabase
    .from("import_logs")
    .insert({
      finished_at: new Date().toISOString(),
      import_status: "completed",
      records_inserted: importedRows.length,
      records_seen: payload.rows.length,
      source,
      source_file: fileName
    });

  if (logError) throw logError;

  return {
    currentReleaseName: currentReleaseRow.song,
    importedMetrics: importedRows.length,
    reportEndDate: payload.reportEndDate,
    songs: payload.rows.length,
    totalPlays,
    totalShazams
  };
}

async function resolveCurrentReleaseName(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  payload: AppleMusicImportPayload
) {
  const songsByNormalizedTitle = new Map(
    payload.rows.map((row) => [normalizeSongTitle(row.song), row.song])
  );
  const { data: releasedCampaigns, error } = await supabase
    .from("marketing_campaigns")
    .select("title,release_date")
    .lte("release_date", payload.reportEndDate)
    .order("release_date", { ascending: false });

  if (error) throw error;

  for (const campaign of releasedCampaigns ?? []) {
    const matchingSong = songsByNormalizedTitle.get(
      normalizeSongTitle(campaign.title)
    );

    if (matchingSong) {
      return matchingSong;
    }
  }

  const requestedRelease = songsByNormalizedTitle.get(
    normalizeSongTitle(payload.currentReleaseName ?? "")
  );

  return requestedRelease ?? payload.rows[0].song;
}

function normalizeSongTitle(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function findOrCreateSong(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  title: string
) {
  const { data: existingSong, error: selectError } = await supabase
    .from("songs")
    .select("id,title")
    .ilike("title", title)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existingSong) {
    return existingSong;
  }

  const { data: insertedSong, error: insertError } = await supabase
    .from("songs")
    .insert({
      status: "released",
      title
    })
    .select("id,title")
    .single();

  if (insertError) throw insertError;

  return insertedSong;
}

function isAuthorizedAppleImportRequest(request: NextRequest) {
  if (
    request.method !== "POST" ||
    request.headers.get("x-love-strings-import") !== "apple-music-csv"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return false;
  }

  return new URL(origin).host === host;
}

function validateAppleMusicImportPayload(payload: AppleMusicImportPayload) {
  if (!payload.reportEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.reportEndDate)) {
    return "Missing or invalid reportEndDate.";
  }

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    return "No Apple Music CSV rows found.";
  }

  for (const row of payload.rows) {
    if (!row.song || row.song.trim().length === 0) {
      return "Every Apple Music row needs a song title.";
    }
  }

  return null;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function formatDateForDisplay(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

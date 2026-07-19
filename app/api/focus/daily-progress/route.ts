import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type FocusStatus = "not-started" | "in-progress" | "done" | "irrelevant";
type FocusSource = "Marketing" | "Production" | "Other";
type DailyProgressItem = {
  date: string;
  label: string;
  source: FocusSource;
  status: FocusStatus;
  taskKey: string;
};

const allowedStatuses: FocusStatus[] = [
  "not-started",
  "in-progress",
  "done",
  "irrelevant"
];
const allowedSources: FocusSource[] = ["Marketing", "Production", "Other"];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!hasValidBasicAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const date = normalizeDate(request.nextUrl.searchParams.get("date") ?? "");

  if (!date) {
    return NextResponse.json({ error: "Missing or invalid date." }, { status: 400 });
  }

  try {
    return NextResponse.json({ items: await loadItems(date), status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Daily focus progress load failed.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidBasicAuth(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { item?: DailyProgressItem };
    const item = normalizeItem(payload.item);
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.from("focus_daily_progress").upsert(
      {
        activity_date: item.date,
        label: item.label,
        source: item.source,
        status: item.status,
        task_key: item.taskKey
      },
      { onConflict: "activity_date,task_key" }
    );

    if (error) throw error;

    return NextResponse.json({ items: await loadItems(item.date), status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Daily focus progress save failed.") },
      { status: 500 }
    );
  }
}

async function loadItems(date: string) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("focus_daily_progress")
    .select("activity_date, task_key, source, label, status")
    .eq("activity_date", date)
    .order("updated_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((item) => ({
    date: item.activity_date,
    label: item.label,
    source: item.source,
    status: item.status,
    taskKey: item.task_key
  }));
}

function normalizeItem(item?: DailyProgressItem): DailyProgressItem {
  const date = normalizeDate(item?.date ?? "");
  const taskKey = item?.taskKey?.trim();
  const source = item?.source;
  const status = item?.status;

  if (!date || !taskKey || !source || !allowedSources.includes(source)) {
    throw new Error("Daily focus progress item is incomplete.");
  }

  if (!status || !allowedStatuses.includes(status)) {
    throw new Error("Daily focus progress status is invalid.");
  }

  return {
    date,
    label: typeof item?.label === "string" ? item.label : "",
    source,
    status,
    taskKey
  };
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function hasValidBasicAuth(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return process.env.NODE_ENV === "development";
  }

  const expectedAuthorization = `Basic ${Buffer.from(
    `${expectedUser}:${expectedPassword}`
  ).toString("base64")}`;

  return request.headers.get("authorization") === expectedAuthorization;
}

function isSameOriginWrite(request: NextRequest) {
  if (request.headers.get("x-love-strings-focus") !== "write") return false;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!host) return false;
  if (fetchSite === "same-origin") return true;
  if (origin) return new URL(origin).host === host;
  if (referer) return new URL(referer).host === host;

  return false;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

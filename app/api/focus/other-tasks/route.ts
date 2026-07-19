import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OtherTaskStatus = "not-started" | "in-progress" | "done" | "irrelevant";
type OtherTask = {
  dueDate: string;
  id: string;
  notes: string;
  status: OtherTaskStatus;
  title: string;
};
type OtherTaskRow = {
  due_date: string;
  stable_key: string;
  notes: string;
  status: OtherTaskStatus;
  title: string;
};

const allowedStatuses: OtherTaskStatus[] = [
  "not-started",
  "in-progress",
  "done",
  "irrelevant"
];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request, false)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ status: "ok", tasks: await loadTasks() });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Other tasks load failed.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request, true)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { tasks?: OtherTask[] };

  try {
    const tasks = (payload.tasks ?? []).map(normalizeTask);
    const supabase = createServiceSupabaseClient();

    if (tasks.length > 0) {
      const { error } = await supabase.from("focus_other_tasks").upsert(
        tasks.map((task) => ({
          due_date: formatInputDateForDatabase(task.dueDate),
          stable_key: task.id,
          notes: task.notes,
          source: "app",
          status: task.status,
          title: task.title
        })),
        { onConflict: "stable_key" }
      );

      if (error) throw error;
    }

    return NextResponse.json({ status: "ok", tasks: await loadTasks() });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Other tasks save failed.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedRequest(request, true)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { id?: string };
  const stableKey = payload.id?.trim();

  if (!stableKey) {
    return NextResponse.json({ error: "Missing task id." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase
      .from("focus_other_tasks")
      .delete()
      .eq("stable_key", stableKey);

    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Other task delete failed.") },
      { status: 500 }
    );
  }
}

async function loadTasks() {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("focus_other_tasks")
    .select("stable_key, title, notes, due_date, status")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as OtherTaskRow[]).map((task) => ({
    dueDate: formatDatabaseDateForInput(task.due_date),
    id: task.stable_key,
    notes: task.notes,
    status: normalizeStatus(task.status),
    title: task.title
  }));
}

function normalizeTask(task: OtherTask): OtherTask {
  const id = task.id?.trim();
  const dueDate = formatInputDateForDatabase(task.dueDate);

  if (!id) {
    throw new Error("Other task is missing its stable id.");
  }

  if (!dueDate) {
    throw new Error(`Invalid due date for ${task.title || "other task"}.`);
  }

  return {
    dueDate: formatDatabaseDateForInput(dueDate),
    id,
    notes: typeof task.notes === "string" ? task.notes : "",
    status: normalizeStatus(task.status),
    title: typeof task.title === "string" ? task.title : ""
  };
}

function normalizeStatus(status: string): OtherTaskStatus {
  return allowedStatuses.includes(status as OtherTaskStatus)
    ? (status as OtherTaskStatus)
    : "not-started";
}

function formatInputDateForDatabase(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function formatDatabaseDateForInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function isAuthorizedRequest(request: NextRequest, requiresWrite: boolean) {
  if (!requiresWrite) {
    return true;
  }

  if (request.headers.get("x-love-strings-focus") !== "write") {
    return false;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!host) {
    return false;
  }

  if (fetchSite === "same-origin") {
    return true;
  }

  if (origin) {
    return new URL(origin).host === host;
  }

  if (referer) {
    return new URL(referer).host === host;
  }

  return false;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

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

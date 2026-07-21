import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RoadmapPhasePayload = {
  description?: string;
  endMonth?: string;
  id?: string;
  startMonth?: string;
  title?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    return NextResponse.json({ phases: await loadPhases(), status: "ok" });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data: latestPhase, error: latestError } = await supabase
      .from("roadmap_phases")
      .select("phase_number, end_month")
      .order("phase_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const phaseNumber = Number(latestPhase?.phase_number ?? 0) + 1;
    const startMonth = addMonths(latestPhase?.end_month ?? getCurrentMonth(), 1);
    const endMonth = addMonths(startMonth, 11);
    const { error } = await supabase.from("roadmap_phases").insert({
      description: "Define the purpose and expected outcome of this phase.",
      end_month: endMonth,
      id: `phase-${phaseNumber}`,
      phase_number: phaseNumber,
      position: phaseNumber,
      start_month: startMonth,
      title: `New Phase ${phaseNumber}`
    });
    if (error) throw error;

    return NextResponse.json({ phases: await loadPhases(), status: "ok" });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as RoadmapPhasePayload;
    const id = payload.id?.trim();
    const startMonth = normalizeMonth(payload.startMonth);
    const endMonth = normalizeMonth(payload.endMonth);
    if (!id || !startMonth || !endMonth || endMonth < startMonth) {
      return NextResponse.json({ error: "Invalid phase settings." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase
      .from("roadmap_phases")
      .update({
        description: payload.description?.trim() ?? "",
        end_month: `${endMonth}-01`,
        start_month: `${startMonth}-01`,
        title: payload.title?.trim() || "Untitled phase"
      })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ phases: await loadPhases(), status: "ok" });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

async function loadPhases() {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("roadmap_phases")
    .select("id, phase_number, title, start_month, end_month, description, position")
    .order("position", { ascending: true })
    .order("phase_number", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((phase) => ({
    endMonth: String(phase.end_month).slice(0, 7),
    id: phase.id,
    phaseNumber: phase.phase_number,
    startMonth: String(phase.start_month).slice(0, 7),
    summary: phase.description,
    title: phase.title
  }));
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function normalizeMonth(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return value ?? null;
}

function addMonths(value: string, amount: number) {
  const [year, month] = String(value).slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 10);
}

function getCurrentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Europe/Vienna",
    year: "numeric"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}-01`;
}

function isAuthorizedRequest(request: NextRequest) {
  if (request.headers.get("x-love-strings-roadmap") !== "write") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return false;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  return Boolean(origin && new URL(origin).host === host);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Roadmap phase request failed.";
}

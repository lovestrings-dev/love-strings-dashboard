import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CreatedSong = {
  id: string;
  slug: string;
  title: string;
  production_deadline: string;
  release_date: string;
  roadmap_general_position: number;
  roadmap_phase_id: string | null;
  album_art_url: string;
  scheduling_model: "template-v1";
  production_template_id: string;
  production_template_version: number;
  production_template_snapshot: unknown;
};

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedProductionRequest(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { title } = await request.json() as { title?: unknown };
    if (title !== undefined && typeof title !== "string") {
      return NextResponse.json({ error: "Production song title must be text." }, { status: 400 });
    }

    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase.rpc("create_roadmap_aware_production_v1_song", {
      p_title: typeof title === "string" ? title.trim() : "",
      p_workspace_id: workspaceId
    });
    if (error) throw error;

    const song = (Array.isArray(data) ? data[0] : data) as CreatedSong | null;
    if (!song?.id || !song.slug) {
      throw new Error("Roadmap-aware Production creation did not return a song.");
    }

    const { data: steps, error: stepsError } = await supabase
      .from("production_steps")
      .select("id, stable_key, label, step_deadline, status, notes, position, is_default_step, template_step_id, template_step_stable_key, template_step_kind, template_step_lead_time_days, template_step_standard_cost_amount, production_budget_lines (id, description, amount, budget_bucket, position)")
      .eq("production_song_id", song.id)
      .order("position", { ascending: true });
    if (stepsError) throw stepsError;

    return NextResponse.json({ song, steps: steps ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Roadmap-aware Production creation failed." },
      { status: error instanceof WorkspaceAccessError ? error.status : 500 }
    );
  }
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function isAuthorizedProductionRequest(request: NextRequest) {
  if (request.headers.get("x-love-strings-production") !== "write") return false;
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

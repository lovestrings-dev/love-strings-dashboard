import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";
import { parseIsoDate } from "@/lib/date-input";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = () => { if (!url || !key) throw new Error("Supabase administration is not configured."); return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); };
const authorized = (r: NextRequest) => r.headers.get("x-love-strings-roadmap") === "write" && Boolean(r.headers.get("host"));
const date = (v: unknown) => typeof v === "string" && parseIsoDate(v) ? v : null;

export async function GET(request: NextRequest) {
  try { const { workspaceId } = await requireWorkspaceAccess(request); return NextResponse.json({ plans: await load(workspaceId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Roadmap plans load failed." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { workspaceId } = await requireWorkspaceAccess(request); const body = await request.json() as Record<string, unknown>;
    const planType = body.planType;
    const suppliedTitle = typeof body.title === "string" ? body.title.trim() : "";
    const title = suppliedTitle || (planType === "auto" ? "My Album Name" : "");
    const suppliedStart = date(body.startDate), suppliedEnd = date(body.endDate);
    const start = planType === "auto" && suppliedStart ? `${suppliedStart.slice(0, 7)}-01` : suppliedStart;
    const end = planType === "auto" && suppliedEnd ? `${suppliedEnd.slice(0, 7)}-01` : suppliedEnd;
    if (!title || (planType !== "auto" && planType !== "manual") || !start || !end || end < start) return NextResponse.json({ error: "Invalid roadmap plan." }, { status: 400 });
    const db = client(); const description = typeof body.description === "string" ? body.description.trim() : "";
    const [{ data: last, error: lastError }, { data: lastAuto, error: lastAutoError }] = await Promise.all([db.from("roadmap_planning_instances").select("display_position").eq("workspace_id", workspaceId).order("display_position", { ascending: false }).limit(1).maybeSingle(), db.from("roadmap_planning_instances").select("phase_number").eq("workspace_id", workspaceId).eq("plan_type", "auto").order("phase_number", { ascending: false }).limit(1).maybeSingle()]); if (lastError || lastAutoError) throw lastError ?? lastAutoError;
    const position = Number(last?.display_position ?? 0) + 1;
    if (planType === "auto") {
      const phaseNumber = Number(lastAuto?.phase_number ?? 0) + 1;
      const { error } = await db.from("roadmap_phases").insert({ id: `${workspaceId}-phase-${phaseNumber}`, workspace_id: workspaceId, phase_number: phaseNumber, position, title, description, start_month: start, end_month: end }); if (error) throw error;
    } else {
      const { error } = await db.from("roadmap_planning_instances").insert({ id: crypto.randomUUID(), workspace_id: workspaceId, plan_type: "manual", title, description, timeframe_start: start, timeframe_end: end, display_position: position, phase_number: null }); if (error) throw error;
    }
    return NextResponse.json({ plans: await load(workspaceId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Roadmap plan creation failed." }, { status: 500 }); }
}
export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try { const { workspaceId } = await requireWorkspaceAccess(request); const body = await request.json() as Record<string, unknown>; const id = typeof body.id === "string" ? body.id : ""; const title = typeof body.title === "string" ? body.title.trim() : ""; const start = date(body.startDate), end = date(body.endDate); if (!id || !title || !start || !end || end < start) return NextResponse.json({ error: "Invalid roadmap plan." }, { status: 400 }); const db = client(); const { data: plan, error } = await db.from("roadmap_planning_instances").select("plan_type").eq("workspace_id", workspaceId).eq("id", id).single(); if (error) throw error; const values = { title, description: typeof body.description === "string" ? body.description.trim() : "", timeframe_start: start, timeframe_end: end }; const result = plan.plan_type === "auto" ? await db.from("roadmap_phases").update({ title, description: values.description, start_month: start, end_month: end }).eq("workspace_id", workspaceId).eq("id", id) : await db.from("roadmap_planning_instances").update(values).eq("workspace_id", workspaceId).eq("id", id); if (result.error) throw result.error; return NextResponse.json({ plans: await load(workspaceId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Roadmap plan save failed." }, { status: 500 }); }
}
export async function PUT(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try { const { workspaceId } = await requireWorkspaceAccess(request); const body = await request.json() as { id?: string; songId?: string; action?: string; direction?: number }; if (!body.id || !body.songId || !body.action) return NextResponse.json({ error: "Invalid membership change." }, { status: 400 }); const { error } = await client().rpc("mutate_manual_roadmap_plan_membership", { p_workspace_id: workspaceId, p_plan_id: body.id, p_action: body.action, p_song_id: body.songId, p_direction: body.direction ?? null }); if (error) throw error; return NextResponse.json({ plans: await load(workspaceId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Manual membership update failed." }, { status: 500 }); }
}
export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { role, workspaceId } = await requireWorkspaceAccess(request);
    if (role !== "admin") return NextResponse.json({ error: "Only a workspace Admin can delete Manual Collection Plans." }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "Invalid Manual Collection Plan." }, { status: 400 });

    const { data: deletedPlan, error } = await client()
      .from("roadmap_planning_instances")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .eq("plan_type", "manual")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!deletedPlan) return NextResponse.json({ error: "Manual Collection Plan was not found." }, { status: 404 });

    return NextResponse.json({ plans: await load(workspaceId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Manual Collection Plan deletion failed." }, { status: 500 }); }
}
async function load(workspaceId: string) { const { data, error } = await client().from("roadmap_planning_instances").select("id, plan_type, title, description, timeframe_start, timeframe_end, display_position, phase_number, roadmap_planning_instance_songs(production_song_id, local_position)").eq("workspace_id", workspaceId).order("display_position"); if (error) throw error; return (data ?? []).map((p) => ({ id:p.id, planType:p.plan_type, title:p.title, summary:p.description, startDate:String(p.timeframe_start).slice(0,10), endDate:String(p.timeframe_end).slice(0,10), displayPosition:p.display_position, phaseNumber:p.phase_number, songIds:(p.roadmap_planning_instance_songs ?? []).sort((a,b)=>(a.local_position ?? 0)-(b.local_position ?? 0)).map((m)=>m.production_song_id) })); }

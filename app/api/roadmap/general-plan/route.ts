import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addRoadmapDays, isRoadmapSongReleased, moveRoadmapAutoPlanSong, moveRoadmapSong, replanFutureRoadmap } from "@/lib/roadmap-general-planner";
import { createProductionV1SongPlanFromSnapshot, recalculateProductionV1Song } from "@/lib/production-template-v1";
import { getWorkspaceDateKey, resolveTimeZone } from "@/lib/workspace-time";
import { requireWorkspaceAccess, requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

type Action =
  | { type: "anchor"; songId: string; releaseDate: string }
  | { type: "move"; songId: string; direction: -1 | 1 }
  | { type: "auto-move"; songId: string; autoPlanId: string; direction: -1 | 1 }
  | { type: "replan" };
type PlannedSong = { id: string; position: number; releaseDate: string; autoPlanId: string | null };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function api(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function db() {
  if (!url || !key) throw new Error("Supabase administration is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function iso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return api({ error: "Unauthorized request." }, { status: 401 });
    const action = await request.json() as Action;
    const { workspaceId } = await requireWorkspaceAdministrator(request);
    const client = db();
    const [{ data: settings, error: settingsError }, { data: songs, error: songsError }, { data: steps, error: stepsError }, { data: tasks, error: tasksError }, { data: budgetLines, error: budgetError }] = await Promise.all([
      client.from("app_workspace_settings").select("roadmap_standard_release_cadence_days, timezone").eq("workspace_id", workspaceId).single(),
      client.from("production_songs").select("id, slug, title, production_deadline, release_date, roadmap_phase_id, album_art_url, scheduling_model, production_template_id, production_template_version, production_template_snapshot, roadmap_general_position").eq("workspace_id", workspaceId).order("roadmap_general_position"),
      client.from("production_steps").select("id, production_song_id, stable_key, label, step_deadline, status, notes, position, is_default_step, template_step_id, template_step_stable_key, template_step_kind, template_step_lead_time_days, template_step_standard_cost_amount"),
      client.from("production_step_tasks").select("id, production_step_id, title, status, position"),
      client.from("production_budget_lines").select("id, production_step_id, production_step_task_id, description, amount, budget_bucket, position")
    ]);
    for (const error of [settingsError, songsError, stepsError, tasksError, budgetError]) if (error) throw error;
    if (!settings || !songs || !steps || !tasks || !budgetLines) throw new Error("Roadmap planning data is unavailable.");
    const cadenceDays = Number(settings.roadmap_standard_release_cadence_days);
    const today = getWorkspaceDateKey(resolveTimeZone(settings.timezone) ?? "Europe/Vienna");
    const ordered: PlannedSong[] = songs.map((song) => ({ id: song.id, position: song.roadmap_general_position, releaseDate: song.release_date, autoPlanId: song.roadmap_phase_id }));
    let planned: PlannedSong[] = ordered;
    if (action.type === "anchor") {
      const releaseDate = iso(action.releaseDate);
      const target = planned.find((song) => song.id === action.songId);
      if (!releaseDate || !target) return api({ error: "Invalid roadmap anchor." }, { status: 400 });
      if (isRoadmapSongReleased(target.releaseDate, today)) return api({ error: "Released songs cannot be replanned." }, { status: 400 });
      const source = planned.map((song) => song.id === target.id ? { ...song, releaseDate } : song);
      planned = withAutoPlans(replanFutureRoadmap({ songs: source, cadenceDays, anchorPosition: target.position, today }), source);
    } else if (action.type === "move") {
      if (action.direction !== -1 && action.direction !== 1) return api({ error: "Invalid roadmap move." }, { status: 400 });
      planned = withAutoPlans(moveRoadmapSong({ songs: planned, songId: action.songId, direction: action.direction, today, cadenceDays }), planned);
    } else if (action.type === "auto-move") {
      if (!action.autoPlanId || (action.direction !== -1 && action.direction !== 1)) return api({ error: "Invalid Auto-plan move." }, { status: 400 });
      planned = moveRoadmapAutoPlanSong({ songs: planned, songId: action.songId, autoPlanId: action.autoPlanId, direction: action.direction, today });
    } else if (action.type === "replan") {
      const firstFuture = planned.find((song) => !isRoadmapSongReleased(song.releaseDate, today));
      if (!firstFuture) return api({ songs: [], status: "unchanged" });
      planned = withAutoPlans(replanFutureRoadmap({ songs: planned, cadenceDays, anchorPosition: firstFuture.position, today }), planned);
    } else return api({ error: "Unknown roadmap operation." }, { status: 400 });

    const plannedById = new Map(planned.map((song) => [song.id, song]));
    const payloadSongs = songs.map((song) => {
      const next = plannedById.get(song.id)!;
      const changed = song.release_date !== next.releaseDate || song.roadmap_general_position !== next.position;
      const songSteps = steps.filter((step) => step.production_song_id === song.id).sort((a, b) => a.position - b.position).map((step) => ({
        id: step.stable_key, label: step.label, deadline: step.step_deadline, isDefaultStep: step.is_default_step, notes: step.notes, position: step.position, status: step.status,
        templateStepId: step.template_step_id ?? undefined, templateStepStableKey: step.template_step_stable_key ?? undefined, templateStepKind: step.template_step_kind ?? undefined,
        templateStepLeadTimeDays: step.template_step_lead_time_days ?? undefined, templateStepStandardCostAmount: step.template_step_standard_cost_amount === null ? undefined : Number(step.template_step_standard_cost_amount),
        budgetLines: budgetLines.filter((line) => line.production_step_id === step.id).sort((a, b) => a.position - b.position).map((line) => ({ id: line.id, amount: Number(line.amount), description: line.description, bucket: line.budget_bucket })),
        extraTasks: tasks.filter((task) => task.production_step_id === step.id).sort((a, b) => a.position - b.position).map((task) => ({ id: task.id, title: task.title, status: task.status, position: task.position, budgetLines: budgetLines.filter((line) => line.production_step_task_id === task.id).sort((a, b) => a.position - b.position).map((line) => ({ id: line.id, amount: Number(line.amount), description: line.description, bucket: line.budget_bucket })) }))
      }));
      let deadline = song.production_deadline;
      let scheduledSteps = songSteps;
      if (changed && song.scheduling_model === "template-v1") {
        const plan = createProductionV1SongPlanFromSnapshot({ liveSteps: songSteps.map((step) => ({ id: step.templateStepId ?? step.id, deadline: step.deadline, status: step.status })), productionDeadline: deadline, releaseDate: song.release_date, snapshot: song.production_template_snapshot });
        const recalculated = recalculateProductionV1Song(plan, next.releaseDate);
        deadline = recalculated.productionDeadline;
        scheduledSteps = songSteps.map((step) => ({ ...step, deadline: recalculated.steps.find((candidate) => candidate.id === (step.templateStepId ?? step.id))?.deadline ?? step.deadline }));
      } else if (changed && song.scheduling_model !== "template-v1") {
        deadline = addRoadmapDays(next.releaseDate, -14);
        const offsets: Record<string, number> = { drums: -33, guitars: -30, bass: -29, vocals: -26, mix: -18, master: -17, license: -16, "cover-art": -15, distributor: -14 };
        scheduledSteps = songSteps.map((step) => ({ ...step, deadline: offsets[step.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")] === undefined ? step.deadline : addRoadmapDays(next.releaseDate, offsets[step.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")]) }));
      }
      return { dbId: song.id, id: song.slug, title: song.title, deadline, releaseDate: next.releaseDate, roadmapPhaseId: song.roadmap_phase_id, roadmapGeneralPosition: next.position, albumArtUrl: song.album_art_url, schedulingModel: song.scheduling_model, productionTemplateId: song.production_template_id ?? undefined, productionTemplateVersion: song.production_template_version ?? undefined, productionTemplateSnapshot: song.production_template_snapshot, steps: scheduledSteps, isChanged: changed };
    });
    const { data, error } = await client.rpc("apply_roadmap_general_plan", { p_workspace_id: workspaceId, p_songs: payloadSongs });
    if (error) throw error;
    return api({ songs: data, status: "updated" });
  } catch (error) {
    console.error("Roadmap planner update failed.", error);
    const details = error && typeof error === "object" ? error as { code?: unknown; details?: unknown; hint?: unknown; message?: unknown } : null;
    return api({ error: typeof details?.message === "string" ? details.message : error instanceof Error ? error.message : "Roadmap planner update failed.", code: details?.code, details: details?.details, hint: details?.hint }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function withAutoPlans(songs: Array<{ id: string; position: number; releaseDate: string }>, source: PlannedSong[]): PlannedSong[] {
  const autoPlanById = new Map(source.map((song) => [song.id, song.autoPlanId]));
  return songs.map((song) => ({ ...song, autoPlanId: autoPlanById.get(song.id) ?? null }));
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin"); const host = request.headers.get("host");
  try { return Boolean(origin && host && new URL(origin).host === host); } catch { return false; }
}

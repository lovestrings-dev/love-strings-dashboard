import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

type MarketingStatus = "not-started" | "in-progress" | "done";
type BudgetSourceBucket = "events" | "production" | "marketing" | "other";
type ProductionBudgetLine = {
  id: string;
  amount: number;
  bucket?: BudgetSourceBucket;
  description: string;
};
type ExtraCampaignTask = {
  id: string;
  budgetLines?: ProductionBudgetLine[];
  title: string;
  status: MarketingStatus;
};
type ProductionStep = {
  id: string;
  label: string;
  deadline: string;
  isDefaultStep: boolean;
  notes: string;
  budgetLines?: ProductionBudgetLine[];
  status: MarketingStatus;
  extraTasks: ExtraCampaignTask[];
  position?: number;
  templateStepId?: string;
  templateStepStableKey?: string;
  templateStepKind?: "idea_anchor" | "production_step" | "release_anchor";
  templateStepLeadTimeDays?: number;
  templateStepStandardCostAmount?: number;
};
type ProductionSongConfig = {
  id: string;
  dbId?: string;
  title: string;
  deadline: string;
  releaseDate: string;
  roadmapPhaseId: string | null;
  albumArtUrl: string;
  steps: ProductionStep[];
  schedulingModel?: "legacy-v0" | "template-v1";
  productionTemplateId?: string;
  productionTemplateVersion?: number;
  productionTemplateSnapshot?: unknown;
};
type ProductionSavePayload = {
  song?: ProductionSongConfig;
  songs?: ProductionSongConfig[];
};
type ProductionDeletePayload = {
  dbId?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!isAuthorizedProductionRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as ProductionSavePayload;
  const songs = payload.songs ?? (payload.song ? [payload.song] : []);

  if (songs.length === 0) {
    return NextResponse.json({ error: "No production songs supplied." }, { status: 400 });
  }

  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const savedSongs = [];

    for (const song of songs) {
      savedSongs.push(await saveProductionSong(song, workspaceId));
    }

    return NextResponse.json({
      savedSongs,
      status: "ok"
    });
  } catch (error) {
    console.error("Production save failed.", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Production save failed.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedProductionRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as ProductionDeletePayload;

  if (!payload.dbId) {
    return NextResponse.json({ error: "Missing production song id." }, { status: 400 });
  }

  const { workspaceId } = await requireWorkspaceAccess(request);
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("production_songs")
    .delete()
    .eq("id", payload.dbId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

async function saveProductionSong(song: ProductionSongConfig, workspaceId: string) {
  if (song.schedulingModel === "template-v1") {
    return saveProductionV1SongAtomically(song, workspaceId);
  }

  const supabase = createServiceSupabaseClient();
  const productionDeadline = formatInputDateForDatabase(song.deadline);
  const releaseDate = formatInputDateForDatabase(song.releaseDate);

  if (!productionDeadline) {
    throw new Error(`Invalid production deadline for ${song.title}.`);
  }

  if (!releaseDate) {
    throw new Error(`Invalid release date for ${song.title}.`);
  }

  const songPayload = {
    slug: createStableId(song.id || song.title) || createStableId(song.title),
    title: song.title,
    production_deadline: productionDeadline,
    release_date: releaseDate,
    roadmap_phase_id: song.roadmapPhaseId,
    album_art_url: song.albumArtUrl,
    source: "app"
  };
  const savedSongResult = song.dbId
    ? await supabase
        .from("production_songs")
        .update(songPayload)
        .eq("id", song.dbId)
        .eq("workspace_id", workspaceId)
        .select("id, slug")
        .maybeSingle()
    : await supabase
        .from("production_songs")
        .upsert(
          { ...songPayload, workspace_id: workspaceId },
          { onConflict: "workspace_id,slug" }
        )
        .select("id, slug")
        .single();
  const { data: savedSong, error: songError } = savedSongResult;

  if (songError) {
    throw songError;
  }

  if (!savedSong) {
    throw new Error("Production song was not found in the active workspace.");
  }

  const { error: campaignSyncError } = await supabase
    .from("marketing_campaigns")
    .update({ release_date: releaseDate })
    .eq("production_song_id", savedSong.id)
    .eq("workspace_id", workspaceId);

  if (campaignSyncError) {
    throw campaignSyncError;
  }

  const { error: deleteStepsError } = await supabase
    .from("production_steps")
    .delete()
    .eq("production_song_id", savedSong.id);

  if (deleteStepsError) {
    throw deleteStepsError;
  }

  if (song.steps.length === 0) {
    return {
      dbId: savedSong.id,
      id: savedSong.slug
    };
  }

  const { data: savedSteps, error: stepError } = await supabase
    .from("production_steps")
    .insert(
      song.steps.map((step, index) => ({
        production_song_id: savedSong.id,
        stable_key: step.id,
        label: step.label,
        step_deadline: formatInputDateForDatabase(step.deadline) ?? productionDeadline,
        status: step.status,
        notes: step.notes,
        position: index + 1,
        is_default_step: step.isDefaultStep
      }))
    )
    .select("id, stable_key");

  if (stepError) {
    throw stepError;
  }

  const stepIdByStableKey = new Map(
    (savedSteps ?? []).map((step) => [step.stable_key, step.id])
  );
  const stepBudgetRows = song.steps.flatMap((step) => {
    const stepId = stepIdByStableKey.get(step.id);

    if (!stepId) {
      return [];
    }

    return normalizeBudgetLines(step.budgetLines ?? []).map((line, index) => ({
      production_step_id: stepId,
      description: line.description,
      amount: line.amount,
      budget_bucket: "production",
      position: index + 1
    }));
  });

  if (stepBudgetRows.length > 0) {
    const { error: budgetError } = await supabase
      .from("production_budget_lines")
      .insert(stepBudgetRows);

    if (budgetError) {
      throw budgetError;
    }
  }

  const taskInputRows = song.steps.flatMap((step) => {
    const stepId = stepIdByStableKey.get(step.id);

    if (!stepId) {
      return [];
    }

    return step.extraTasks.map((task, index) => ({
      production_step_id: stepId,
      title: task.title,
      status: task.status,
      position: index + 1
    }));
  });

  if (taskInputRows.length > 0) {
    const { data: savedTasks, error: taskError } = await supabase
      .from("production_step_tasks")
      .insert(taskInputRows)
      .select("id, production_step_id, position");

    if (taskError) {
      throw taskError;
    }

    const taskIdByStepAndPosition = new Map(
      (savedTasks ?? []).map((task) => [
        `${task.production_step_id}:${task.position}`,
        task.id
      ])
    );
    const taskBudgetRows = song.steps.flatMap((step) => {
      const stepId = stepIdByStableKey.get(step.id);

      if (!stepId) {
        return [];
      }

      return step.extraTasks.flatMap((task, taskIndex) => {
        const taskId = taskIdByStepAndPosition.get(`${stepId}:${taskIndex + 1}`);

        if (!taskId) {
          return [];
        }

        return normalizeBudgetLines(task.budgetLines ?? []).map((line, index) => ({
          production_step_task_id: taskId,
          description: line.description,
          amount: line.amount,
          budget_bucket: "production",
          position: index + 1
        }));
      });
    });

    if (taskBudgetRows.length > 0) {
      const { error: budgetError } = await supabase
        .from("production_budget_lines")
        .insert(taskBudgetRows);

      if (budgetError) {
        throw budgetError;
      }
    }
  }

  return {
    dbId: savedSong.id,
    id: savedSong.slug
  };
}

async function saveProductionV1SongAtomically(
  song: ProductionSongConfig,
  workspaceId: string
) {
  const productionDeadline = formatInputDateForDatabase(song.deadline);
  const releaseDate = formatInputDateForDatabase(song.releaseDate);

  if (!productionDeadline || !releaseDate) {
    throw new Error(`Invalid Production dates for ${song.title}.`);
  }

  if (!song.productionTemplateId || !song.productionTemplateVersion || !song.productionTemplateSnapshot) {
    throw new Error(`Missing Production V1 template snapshot for ${song.title}.`);
  }

  const rpcSong = {
    ...song,
    deadline: productionDeadline,
    releaseDate,
    slug: createStableId(song.id || song.title) || createStableId(song.title),
    steps: song.steps.map((step, index) => {
      const deadline = formatInputDateForDatabase(step.deadline) ?? productionDeadline;
      return {
        ...step,
        deadline,
        position: step.position ?? index + 1,
        budgetLines: normalizeBudgetLines(step.budgetLines ?? []),
        extraTasks: step.extraTasks.map((task, taskIndex) => ({
          ...task,
          position: taskIndex + 1,
          budgetLines: normalizeBudgetLines(task.budgetLines ?? [])
        }))
      };
    })
  };
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("save_production_v1_song_with_derived_custom_timing", {
    p_song: rpcSong,
    p_workspace_id: workspaceId
  });

  if (error) {
    throw error;
  }

  const savedSong = Array.isArray(data) ? data[0] : data;
  if (!savedSong?.id || !savedSong?.slug) {
    throw new Error("Atomic Production V1 save did not return a song.");
  }

  return { dbId: savedSong.id, id: savedSong.slug };
}

function normalizeBudgetLines(budgetLines: ProductionBudgetLine[]) {
  return budgetLines
    .filter((line) => line.description.trim().length > 0 || line.amount !== 0)
    .map((line) => ({
      ...line,
      bucket: "production" as const
    }));
}

function isAuthorizedProductionRequest(request: NextRequest) {
  if (request.headers.get("x-love-strings-production") !== "write") {
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

function createStableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatInputDateForDatabase(value: string) {
  const date = parseInputDate(value);

  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseInputDate(value: string) {
  const normalizedValue = value.trim();
  const match = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsedDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return parsedDate;
}

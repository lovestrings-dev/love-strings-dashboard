import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const presetDays = new Set([7, 14, 21, 28]);

function reply(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("app_workspace_settings").select("roadmap_standard_release_cadence_days").eq("workspace_id", workspaceId).single();
    if (error) throw error;
    return reply({ cadenceDays: data.roadmap_standard_release_cadence_days, preset: presetDays.has(data.roadmap_standard_release_cadence_days) ? data.roadmap_standard_release_cadence_days : null });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Roadmap settings unavailable." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin"); const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return reply({ error: "Unauthorized request." }, { status: 401 });
    const { cadenceDays } = await request.json() as { cadenceDays?: unknown };
    const days = Number(cadenceDays);
    if (!Number.isInteger(days) || days <= 0) return reply({ error: "Enter a positive whole number of days." }, { status: 400 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { error } = await serviceClient.from("app_workspace_settings").update({ roadmap_standard_release_cadence_days: days }).eq("workspace_id", workspaceId);
    if (error) throw error;
    return reply({ cadenceDays: days, preset: presetDays.has(days) ? days : null, status: "updated" });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Roadmap settings update failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

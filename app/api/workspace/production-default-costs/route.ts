import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const fallbackCosts = { distributor: -10, license: -20 };

function normalizeCosts(value: unknown) {
  const costs = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const normalize = (key: "license" | "distributor") => {
    const amount = Number(costs[key]);
    return Number.isFinite(amount) ? -Math.abs(amount) : fallbackCosts[key];
  };
  return { distributor: normalize("distributor"), license: normalize("license") };
}

function response(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("app_workspace_settings").select("production_step_cost_defaults").eq("workspace_id", workspaceId).single();
    if (error) throw error;
    return response({ costs: normalizeCosts(data.production_step_cost_defaults) });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Production defaults unavailable." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return response({ error: "Unauthorized request." }, { status: 401 });
    const { costs } = await request.json() as { costs?: unknown };
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const normalizedCosts = normalizeCosts(costs);
    const { error } = await serviceClient.from("app_workspace_settings").update({ production_step_cost_defaults: normalizedCosts }).eq("workspace_id", workspaceId);
    if (error) throw error;
    return response({ costs: normalizedCosts, status: "updated" });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Production defaults update failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

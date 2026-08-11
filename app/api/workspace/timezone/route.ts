import { NextResponse, type NextRequest } from "next/server";
import {
  requireWorkspaceAccess,
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";
import { resolveTimeZone } from "@/lib/workspace-time";

function response(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient
      .from("app_workspace_settings")
      .select("timezone")
      .eq("workspace_id", workspaceId)
      .single();
    if (error) throw error;
    return response({ timezone: resolveTimeZone(data.timezone) ?? "Europe/Vienna", workspaceId });
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : "Workspace timezone unavailable." },
      { status: error instanceof WorkspaceAccessError ? error.status : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return response({ error: "Unauthorized request." }, { status: 401 });
    const { timezone } = (await request.json()) as { timezone?: string };
    const normalizedTimezone = resolveTimeZone(timezone);
    if (!normalizedTimezone) return response({ error: "Enter a valid IANA timezone." }, { status: 400 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { error } = await serviceClient
      .from("app_workspace_settings")
      .update({ timezone: normalizedTimezone })
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return response({ timezone: normalizedTimezone, workspaceId, status: "updated" });
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : "Workspace timezone update failed." },
      { status: error instanceof WorkspaceAccessError ? error.status : 500 }
    );
  }
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

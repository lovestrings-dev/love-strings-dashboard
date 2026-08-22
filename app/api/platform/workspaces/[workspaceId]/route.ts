import { NextResponse, type NextRequest } from "next/server";

import { parseWorkspaceId } from "@/lib/workspace";
import { requirePlatformOwner, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function DELETE(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const workspaceId = parseWorkspaceId((await context.params).workspaceId);
    if (!workspaceId) return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    const { serviceClient } = await requirePlatformOwner(request);
    const { data: workspace, error: workspaceError } = await serviceClient
      .from("app_workspaces")
      .select("id, name, setup_state, access_state")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });

    const payload = (await request.json()) as { confirmName?: string; confirmed?: boolean };
    if ((workspace.setup_state === "active" || workspace.access_state === "frozen") && payload.confirmName?.trim() !== workspace.name) {
      return NextResponse.json({ error: "Type the exact workspace name to permanently delete it." }, { status: 400 });
    }
    if (workspace.setup_state === "pending_setup" && payload.confirmed !== true) {
      return NextResponse.json({ error: "Confirm deletion of the provisional workspace." }, { status: 400 });
    }

    const { error: deleteError } = await serviceClient.from("app_workspaces").delete().eq("id", workspaceId);
    if (deleteError) throw deleteError;
    return NextResponse.json({ status: "deleted", workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace could not be deleted." }, { status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const workspaceId = parseWorkspaceId((await context.params).workspaceId);
    if (!workspaceId) return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    const { serviceClient } = await requirePlatformOwner(request);
    const payload = (await request.json()) as { action?: "freeze" | "reactivate"; confirmed?: boolean };
    if (payload.action !== "freeze" && payload.action !== "reactivate") return NextResponse.json({ error: "Choose a valid workspace action." }, { status: 400 });
    if (payload.confirmed !== true) return NextResponse.json({ error: "Confirm this workspace action." }, { status: 400 });
    const { data: workspace, error } = await serviceClient.from("app_workspaces").select("id, name, setup_state, access_state").eq("id", workspaceId).maybeSingle();
    if (error) throw error;
    if (!workspace) return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    if (payload.action === "freeze" && workspace.setup_state !== "active") return NextResponse.json({ error: "Only active workspaces can be frozen." }, { status: 409 });
    const nextState = payload.action === "freeze" ? "frozen" : "active";
    if (workspace.access_state === nextState) return NextResponse.json({ status: workspace.access_state, workspaceId });
    const { error: updateError } = await serviceClient.from("app_workspaces").update({ access_state: nextState }).eq("id", workspaceId);
    if (updateError) throw updateError;
    return NextResponse.json({ status: nextState, workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace action failed." }, { status });
  }
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin"); const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

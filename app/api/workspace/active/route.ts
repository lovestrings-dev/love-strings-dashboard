import { NextResponse, type NextRequest } from "next/server";
import {
  requireWorkspaceAccess,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function activeWorkspaceResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    const [{ data: workspace, error: workspaceError }, { data: profile, error: profileError }] = await Promise.all([
      serviceClient.from("app_workspaces").select("setup_state").eq("id", workspaceId).single(),
      serviceClient.from("app_profiles").select("display_name").eq("id", user.id).single()
    ]);
    if (workspaceError) throw workspaceError;
    if (profileError) throw profileError;
    return activeWorkspaceResponse({ displayName: profile.display_name, role, setupState: workspace.setup_state, workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return activeWorkspaceResponse(
      { error: error instanceof Error ? error.message : "Workspace access failed." },
      { status }
    );
  }
}

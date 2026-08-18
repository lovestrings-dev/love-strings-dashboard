import { NextResponse, type NextRequest } from "next/server";

import { toSafeMetaConnectionStatus } from "@/lib/server/meta-connections";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data, error } = await serviceClient.from("app_meta_connections")
      .select("id, app_kind, connection_kind, connection_state, granted_scopes, token_expires_at, last_successful_sync_at, last_error_code, last_error_summary, updated_at")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ connections: (data ?? []).map(toSafeMetaConnectionStatus) });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Meta connection status failed." }, { status });
  }
}

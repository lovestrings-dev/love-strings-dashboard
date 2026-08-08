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
    const { role, workspaceId } = await requireWorkspaceAccess(request);
    return activeWorkspaceResponse({ role, workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return activeWorkspaceResponse(
      { error: error instanceof Error ? error.message : "Workspace access failed." },
      { status }
    );
  }
}

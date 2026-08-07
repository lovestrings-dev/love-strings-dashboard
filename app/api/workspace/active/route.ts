import { NextResponse, type NextRequest } from "next/server";
import {
  requireWorkspaceAccess,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { role, workspaceId } = await requireWorkspaceAccess(request);
    return NextResponse.json({ role, workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace access failed." },
      { status }
    );
  }
}

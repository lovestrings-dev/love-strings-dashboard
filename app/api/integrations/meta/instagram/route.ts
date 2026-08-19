import { NextResponse, type NextRequest } from "next/server";
import { readCreatorSocialInstagramState } from "@/lib/server/meta-connections";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    return NextResponse.json({ state: await readCreatorSocialInstagramState(serviceClient, workspaceId) });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Instagram connection status failed." : error instanceof Error ? error.message : "Access denied." }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { error } = await (serviceClient as any).rpc("disconnect_creator_social_instagram", { p_workspace_id: workspaceId });
    if (error) throw error;
    return NextResponse.json({ state: "disconnected" });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Instagram could not be disconnected." : error instanceof Error ? error.message : "Access denied." }, { status });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function PATCH(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { name } = (await request.json()) as { name?: string };
    const trimmedName = name?.trim() ?? "";
    if (trimmedName.length < 2 || trimmedName.length > 120) return NextResponse.json({ error: "Workspace name must be 2 to 120 characters." }, { status: 400 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { error } = await serviceClient.from("app_workspaces").update({ name: trimmedName }).eq("id", workspaceId);
    if (error) throw error;
    return NextResponse.json({ name: trimmedName, workspaceId, status: "renamed" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace rename failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }
}
function sameOrigin(request: NextRequest) { const origin=request.headers.get("origin"),host=request.headers.get("host"); try{return Boolean(origin&&host&&new URL(origin).host===host)}catch{return false} }

import { NextResponse, type NextRequest } from "next/server";
import { reconcileInstagramReelPublication } from "@/lib/server/instagram-reel-publishing";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ publicationId: string }> }) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { publicationId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return NextResponse.json({ error: "Invalid publication." }, { status: 400 });
    const { serviceClient, workspaceId, user } = await requireWorkspaceAdministrator(request);
    const result = await reconcileInstagramReelPublication(serviceClient, { workspaceId, publicationId, operatorId: user.id });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Reconciliation failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 400 }); }
}

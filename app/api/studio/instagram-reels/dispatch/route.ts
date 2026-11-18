import { NextResponse, type NextRequest } from "next/server";
import { dispatchOneInstagramReel, instagramReelPublishingEnabled, manualInstagramReelDispatchEnabled } from "@/lib/server/instagram-reel-publishing";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    if (!instagramReelPublishingEnabled(workspaceId) || !manualInstagramReelDispatchEnabled()) return NextResponse.json({ error: "Manual publishing dispatch is disabled." }, { status: 503 });
    return NextResponse.json(await dispatchOneInstagramReel(serviceClient, workspaceId));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 400 }); }
}

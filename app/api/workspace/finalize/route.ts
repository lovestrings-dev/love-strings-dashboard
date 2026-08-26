import { NextResponse, type NextRequest } from "next/server";

import {
  requireWorkspaceAccess,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (role !== "admin") return NextResponse.json({ error: "Only a workspace Admin can finish setup." }, { status: 403 });
    const payload = (await request.json()) as {
      artistBandName?: string;
      distributorAnswer?: unknown;
      releaseFrequency?: unknown;
      userName?: string;
    };
    const userName = payload.userName?.trim() ?? "";
    const artistBandName = payload.artistBandName?.trim() ?? "";
    if (userName.length < 1 || userName.length > 120) return NextResponse.json({ error: "Enter a valid User Name." }, { status: 400 });
    if (artistBandName.length < 2 || artistBandName.length > 120) return NextResponse.json({ error: "Enter a valid Artist or Band Name." }, { status: 400 });
    if (payload.releaseFrequency !== "twice_monthly" && payload.releaseFrequency !== "monthly" && payload.releaseFrequency !== "undecided") {
      return NextResponse.json({ error: "Choose how often you plan to release songs." }, { status: 400 });
    }
    if (payload.distributorAnswer !== "yes" && payload.distributorAnswer !== "no" && payload.distributorAnswer !== "unknown") {
      return NextResponse.json({ error: "Choose whether you already have a Distributor." }, { status: 400 });
    }

    const { data, error } = await serviceClient.rpc("finalize_pending_workspace", {
      p_distributor_answer: payload.distributorAnswer,
      p_display_name: userName,
      p_release_frequency: payload.releaseFrequency,
      p_user_id: user.id,
      p_workspace_id: workspaceId,
      p_workspace_name: artistBandName
    });
    if (error) throw error;
    const workspace = data?.[0];
    if (!workspace) throw new Error("Workspace setup could not be completed.");
    return NextResponse.json({ status: workspace.outcome, workspace });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace setup could not be completed." }, { status });
  }
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin"); const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

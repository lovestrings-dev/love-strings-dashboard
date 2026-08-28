import { NextResponse, type NextRequest } from "next/server";

import { isGettingStartedV1ActorEligible, type GuidanceStatus } from "@/lib/guidance";
import { getGuidancePreviewStatus } from "@/lib/guidance-preview";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (!(await canViewGettingStartedGuidance(serviceClient, user.id, role))) return inactiveResponse();
    // One workspace-scoped RPC evaluates all canonical completion signals and
    // returns the compact client contract. The browser never fans this out.
    const { data, error } = await serviceClient.rpc("get_guidance_status", {
      p_workspace_id: workspaceId
    });
    if (error) throw error;

    const previewMode = request.nextUrl.searchParams.get("guidancePreview");
    if (previewMode) {
      const { data: workspace, error: workspaceError } = await serviceClient
        .from("app_workspaces")
        .select("name")
        .eq("id", workspaceId)
        .maybeSingle();
      if (workspaceError) throw workspaceError;

      const preview = getGuidancePreviewStatus({
        hostname: request.nextUrl.hostname,
        mode: previewMode,
        nodeEnv: process.env.NODE_ENV,
        workspaceName: workspace?.name ?? null
      });
      if (preview) {
        const response = NextResponse.json(preview);
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
        return response;
      }
    }

    const response = NextResponse.json((data ?? { active: false }) as GuidanceStatus);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Guidance status failed." },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role, serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    if (!(await canViewGettingStartedGuidance(serviceClient, user.id, role))) {
      return NextResponse.json({ error: "Getting Started Guidance is available to Workspace Admins only." }, { status: 403 });
    }
    const payload = (await request.json().catch(() => null)) as { action?: string; step?: string } | null;
    if (payload?.action === "close") {
      const { data, error } = await serviceClient.rpc("dismiss_getting_started_guidance", {
        p_workspace_id: workspaceId
      });
      if (error) throw error;
      const response = NextResponse.json((data ?? { active: false }) as GuidanceStatus);
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      return response;
    }
    if (payload?.step !== "first_song" && payload?.step !== "google_youtube" && payload?.step !== "invite_member") {
      return NextResponse.json({ error: "Only actionable Guidance steps can be skipped." }, { status: 400 });
    }
    const { data, error } = await serviceClient.rpc("skip_getting_started_guidance_step", {
      p_step: payload.step,
      p_workspace_id: workspaceId
    });
    if (error) throw error;
    const response = NextResponse.json((data ?? { active: false }) as GuidanceStatus);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Guidance skip failed." },
      { status }
    );
  }
}

async function canViewGettingStartedGuidance(
  serviceClient: Awaited<ReturnType<typeof requireWorkspaceAccess>>["serviceClient"],
  userId: string,
  workspaceRole: "admin" | "member" | "viewer"
) {
  if (workspaceRole !== "admin") return false;
  const { data: operator, error } = await serviceClient
    .from("app_platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return isGettingStartedV1ActorEligible({ isPlatformOwner: Boolean(operator), workspaceRole });
}

function inactiveResponse() {
  const response = NextResponse.json({ active: false } satisfies GuidanceStatus);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

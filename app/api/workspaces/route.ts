import { NextResponse, type NextRequest } from "next/server";
import { activeWorkspaceCookieName, parseWorkspaceId } from "@/lib/workspace";
import { createServiceSupabaseClient, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const dynamic = "force-dynamic";
export const revalidate = 0;

function workspaceResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request);
    const service = createServiceSupabaseClient();
    const { data: memberships, error } = await service
      .from("app_workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id);
    if (workspaceIds.length === 0) {
      return workspaceResponse({ workspaces: [] });
    }

    const [{ data: workspaceRows, error: workspaceError }, { data: settingsRows, error: settingsError }] =
      await Promise.all([
        service.from("app_workspaces").select("id, name, slug").in("id", workspaceIds),
        service
          .from("app_workspace_settings")
          .select("workspace_id, logo_path")
          .in("workspace_id", workspaceIds),
      ]);
    if (workspaceError) throw workspaceError;
    if (settingsError) throw settingsError;

    const workspaceById = new Map((workspaceRows ?? []).map((workspace) => [workspace.id, workspace]));
    const logoPathByWorkspaceId = new Map(
      (settingsRows ?? []).map((settings) => [settings.workspace_id, settings.logo_path ?? ""]),
    );

    return workspaceResponse({
      workspaces: (memberships ?? []).flatMap((membership) => {
        const workspace = workspaceById.get(membership.workspace_id);
        if (!workspace) return [];
        return [{
          id: workspace.id,
          logoPath: logoPathByWorkspaceId.get(workspace.id) ?? "",
          name: workspace.name,
          role: membership.role,
          slug: workspace.slug,
        }];
      }),
    });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return workspaceResponse({ error: "Workspace list unavailable." }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { workspaceId?: string };
    const workspaceId = parseWorkspaceId(payload.workspaceId);
    if (!workspaceId) return workspaceResponse({ error: "Invalid workspace." }, { status: 400 });
    const user = await authenticatedUser(request);
    const service = createServiceSupabaseClient();
    const { data: membership, error } = await service
      .from("app_workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!membership) return workspaceResponse({ error: "Workspace access denied." }, { status: 403 });
    const response = workspaceResponse({ status: "switched", workspaceId });
    response.cookies.set(activeWorkspaceCookieName, workspaceId, { httpOnly: true, path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
    return response;
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return workspaceResponse({ error: "Workspace switch failed." }, { status });
  }
}

async function authenticatedUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase authentication is not configured.");
  const client = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new WorkspaceAccessError("Sign in again to continue.", 401);
  return user;
}

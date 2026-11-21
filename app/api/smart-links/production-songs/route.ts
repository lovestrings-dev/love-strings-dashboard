import { type NextRequest } from "next/server";
import { errorMessage, errorStatus, smartLinkResponse } from "@/lib/server/smart-links";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

/** A deliberately narrow read model for the Smart Links source-song picker. */
export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId, role } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient
      .from("production_songs")
      .select("id, title, album_art_url")
      .eq("workspace_id", workspaceId)
      .order("title", { ascending: true });
    if (error) throw error;
    const { data: workspace, error: workspaceError } = await serviceClient
      .from("app_workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();
    if (workspaceError) throw workspaceError;
    return smartLinkResponse({ canManage: role !== "viewer", songs: data ?? [], workspaceName: workspace.name });
  } catch (error) {
    return smartLinkResponse({ error: errorMessage(error, "Production songs are unavailable.") }, errorStatus(error));
  }
}

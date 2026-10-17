import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { parseWorkspaceId } from "@/lib/workspace";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient: db, workspaceId, role } = await requireWorkspaceAccess(request);
    const { data: members, error: membersError } = await db.from("app_workspace_members")
      .select("user_id").eq("workspace_id", workspaceId);
    if (membersError) throw membersError;
    const { data: memberships, error: membershipsError } = await db.from("app_workspace_members")
      .select("workspace_id").in("user_id", (members ?? []).map((member) => member.user_id)).neq("workspace_id", workspaceId);
    if (membershipsError) throw membershipsError;
    const destinationIds = [...new Set((memberships ?? []).map((membership) => membership.workspace_id))];
    const { data: destinations, error: destinationsError } = destinationIds.length
      ? await db.from("app_workspaces").select("id, name").in("id", destinationIds).eq("access_state", "active").order("name")
      : { data: [], error: null };
    if (destinationsError) throw destinationsError;
    const [outgoing, incoming] = await Promise.all([
      db.from("production_song_shares").select("production_song_id, destination_workspace_id").eq("source_workspace_id", workspaceId),
      db.from("production_song_shares").select("id, production_song_id, source_workspace_id").eq("destination_workspace_id", workspaceId)
    ]);
    for (const result of [outgoing, incoming]) if (result.error) throw result.error;
    const allowedIncoming = [];
    for (const share of incoming.data ?? []) {
      const { data: allowed, error } = await db.rpc("production_share_destination_allowed", {
        p_source: share.source_workspace_id, p_destination: workspaceId
      });
      if (error) throw error;
      if (allowed) allowedIncoming.push(share);
    }
    const songIds = allowedIncoming.map((share) => share.production_song_id);
    const { data: songs, error: songsError } = songIds.length
      ? await db.from("production_songs").select(`id, slug, title, production_deadline, release_date, album_art_url,
          production_steps (id, production_song_id, stable_key, label, step_deadline, status, notes, position, is_default_step,
            production_step_tasks (id, production_step_id, title, status, position,
              production_budget_lines (id, production_step_id, production_step_task_id, description, amount, budget_bucket, position)),
            production_budget_lines (id, production_step_id, production_step_task_id, description, amount, budget_bucket, position))`)
          .in("id", songIds)
      : { data: [], error: null };
    if (songsError) throw songsError;
    const sourceIds = [...new Set(allowedIncoming.map((share) => share.source_workspace_id))];
    const { data: sources, error: sourcesError } = sourceIds.length
      ? await db.from("app_workspaces").select("id, name").in("id", sourceIds)
      : { data: [], error: null };
    if (sourcesError) throw sourcesError;
    return reply({
      canManage: role === "admin" || role === "member", destinations: destinations ?? [],
      outgoing: outgoing.data ?? [],
      incoming: allowedIncoming.flatMap((share) => {
        const song = songs?.find((song) => song.id === share.production_song_id);
        return song ? [{ shareId: share.id, sourceWorkspaceName: sources?.find((source) => source.id === share.source_workspace_id)?.name ?? "Source workspace", song }] : [];
      })
    });
  } catch (error) {
    return reply({ error: error instanceof WorkspaceAccessError ? error.message : "Song sharing is unavailable. Its database migration may need to be applied." }, error instanceof WorkspaceAccessError ? error.status : 503);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return reply({ error: "Unauthorized request." }, 401);
    const { serviceClient: db, workspaceId, role, user } = await requireWorkspaceAccess(request);
    const body = await request.json() as { action?: unknown; songId?: unknown; shareId?: unknown; destinationId?: unknown };
    const action = body.action;
    if (action !== "share" && action !== "remove-received") return reply({ error: "Unknown sharing action." }, 400);
    if (action === "remove-received") {
      const shareId = typeof body.shareId === "string" ? parseWorkspaceId(body.shareId) : null;
      if (!shareId) return reply({ error: "Choose a received song." }, 400);
      const { error } = await db.rpc("remove_received_production_song_share", { p_workspace_id: workspaceId, p_actor: user.id, p_share_id: shareId });
      if (error) return reply({ error: "This received song could not be removed. Refresh and try again." }, 403);
    } else {
      if (role !== "admin" && role !== "member") return reply({ error: "Only source workspace Admins and Members can manage song sharing." }, 403);
      const destinationId = typeof body.destinationId === "string" ? parseWorkspaceId(body.destinationId) : null;
      if (body.destinationId !== null && !destinationId) return reply({ error: "Choose a destination or Not shared." }, 400);
      const songId = typeof body.songId === "string" ? parseWorkspaceId(body.songId) : null;
      if (action === "share" && !songId) return reply({ error: "Save the source song before sharing it." }, 400);
      const { error } = await db.rpc("set_production_song_sharing", {
        p_workspace_id: workspaceId, p_actor: user.id, p_destination: destinationId,
        p_song_id: songId, p_is_default: false
      });
      if (error) return reply({ error: "Sharing could not be updated. Choose an active workspace with a member in common." }, 400);
    }
    return reply({ status: "ok" });
  } catch (error) {
    return reply({ error: error instanceof WorkspaceAccessError ? error.message : "Song sharing update failed." }, error instanceof WorkspaceAccessError ? error.status : 500);
  }
}

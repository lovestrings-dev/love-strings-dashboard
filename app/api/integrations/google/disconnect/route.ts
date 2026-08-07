import { NextResponse, type NextRequest } from "next/server";

import {
  decryptGoogleRefreshToken,
  isGoogleService,
  revokeGoogleToken
} from "@/lib/google/oauth";
import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { service?: string };
    if (!isGoogleService(payload.service ?? null)) {
      return NextResponse.json({ error: "Unknown Google service." }, { status: 400 });
    }

    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data: connection, error } = await serviceClient
      .from("app_google_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!connection) return NextResponse.json({ status: "disconnected" });

    const otherEnabled =
      payload.service === "youtube"
        ? Boolean(connection.analytics_enabled)
        : Boolean(connection.youtube_enabled);

    if (!otherEnabled) {
      try {
        await revokeGoogleToken(decryptGoogleRefreshToken(connection.encrypted_refresh_token));
      } catch {
        // Local deletion still removes app access if Google revocation is unavailable.
      }
      const { error: deleteError } = await serviceClient
        .from("app_google_connections")
        .delete()
        .eq("workspace_id", workspaceId);
      if (deleteError) throw deleteError;
    } else {
      const updates =
        payload.service === "youtube"
          ? {
              youtube_channel_id: null,
              youtube_channel_title: null,
              youtube_enabled: false
            }
          : {
              analytics_enabled: false,
              analytics_property_id: null,
              analytics_property_name: null
            };
      const { error: updateError } = await serviceClient
        .from("app_google_connections")
        .update(updates)
        .eq("workspace_id", workspaceId);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ status: "disconnected" });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Disconnect failed." },
      { status }
    );
  }
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

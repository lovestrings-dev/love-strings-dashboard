import { NextResponse, type NextRequest } from "next/server";

import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data, error } = await serviceClient
      .from("app_google_connections")
      .select(
        "google_account_email, youtube_enabled, youtube_channel_title, analytics_enabled, analytics_property_id, analytics_property_name, updated_at"
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      accountEmail: data?.google_account_email ?? null,
      analytics: {
        enabled: data?.analytics_enabled ?? false,
        propertyId: data?.analytics_property_id ?? null,
        propertyName: data?.analytics_property_name ?? null
      },
      updatedAt: data?.updated_at ?? null,
      youtube: {
        channelTitle: data?.youtube_channel_title ?? null,
        enabled: data?.youtube_enabled ?? false
      }
    });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Google connection status failed.";
}

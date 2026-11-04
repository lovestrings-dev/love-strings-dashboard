import { getProviderOAuthCallbackUri } from "@/lib/oauth-attempt";
import { createFixedCallbackOAuthAttempt } from "@/lib/server/oauth-attempts";
import { NextResponse, type NextRequest } from "next/server";

import { createGoogleAuthorizationUrl, isGoogleService } from "@/lib/google/oauth";
import {
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const service = request.nextUrl.searchParams.get("service");
    if (!isGoogleService(service)) {
      return NextResponse.json({ error: "Unknown Google service." }, { status: 400 });
    }

    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data: connection, error } = await serviceClient
      .from("app_google_connections")
      .select("google_account_email")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;

    const guidance = request.nextUrl.searchParams.get("guidance") === "1";
    const guidancePreview = process.env.NODE_ENV === "development"
      && request.nextUrl.hostname === "localhost"
      && request.nextUrl.searchParams.get("guidancePreview") === "google";
    const attempt = await createFixedCallbackOAuthAttempt({
      client: serviceClient,
      integrationKind: "google:services",
      origin: request.nextUrl.origin,
      returnTarget: "/?settings=general",
      userId: user.id,
      workspaceId,
      context: { service, guidance, guidancePreview }
    });
    const redirectUri = getProviderOAuthCallbackUri("/api/integrations/google/callback");
    const authorizationUrl = createGoogleAuthorizationUrl({
      loginHint: connection?.google_account_email,
      redirectUri,
      service,
      state: attempt.state
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.redirect(
      createSettingsReturnUrl(
        request,
        "error",
        error instanceof Error ? error.message : "Google authorization could not be started."
      )
    );
  }
}

function createSettingsReturnUrl(request: NextRequest, result: string, message?: string) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  url.searchParams.set("google", result);
  if (message) url.searchParams.set("google_message", message.slice(0, 240));
  return url;
}

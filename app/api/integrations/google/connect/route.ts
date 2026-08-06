import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createGoogleAuthorizationUrl, isGoogleService } from "@/lib/google/oauth";
import {
  loveStringsWorkspaceId,
  requireWorkspaceOwner,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const service = request.nextUrl.searchParams.get("service");
    if (!isGoogleService(service)) {
      return NextResponse.json({ error: "Unknown Google service." }, { status: 400 });
    }

    const { serviceClient } = await requireWorkspaceOwner(request);
    const { data: connection, error } = await serviceClient
      .from("app_google_connections")
      .select("google_account_email")
      .eq("workspace_id", loveStringsWorkspaceId)
      .maybeSingle();
    if (error) throw error;

    const state = randomBytes(32).toString("base64url");
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google/callback`;
    const authorizationUrl = createGoogleAuthorizationUrl({
      loginHint: connection?.google_account_email,
      redirectUri,
      service,
      state
    });
    const response = NextResponse.redirect(authorizationUrl);
    const secure = request.nextUrl.protocol === "https:";
    const cookieOptions = {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/api/integrations/google",
      sameSite: "lax" as const,
      secure
    };
    response.cookies.set("ls_google_oauth_state", state, cookieOptions);
    response.cookies.set("ls_google_oauth_service", service, cookieOptions);
    response.cookies.set("ls_google_oauth_origin", request.nextUrl.origin, cookieOptions);
    return response;
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.redirect(createSettingsReturnUrl(request, "error"));
  }
}

function createSettingsReturnUrl(request: NextRequest, result: string) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  url.searchParams.set("google", result);
  return url;
}


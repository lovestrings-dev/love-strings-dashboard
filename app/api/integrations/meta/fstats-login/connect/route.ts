import { NextResponse, type NextRequest } from "next/server";

import { createFstatsLoginAuthorizationUrl, fstatsLoginIntegrationKind, getFstatsLoginRedirectUri } from "@/lib/meta/fstats-login-oauth";
import { createOAuthAttempt } from "@/lib/server/oauth-attempts";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const attempt = await createOAuthAttempt({
      client: serviceClient,
      integrationKind: fstatsLoginIntegrationKind,
      origin: request.nextUrl.origin,
      returnTarget: request.nextUrl.searchParams.get("return"),
      userId: user.id,
      workspaceId
    });
    return NextResponse.redirect(createFstatsLoginAuthorizationUrl({
      redirectUri: getFstatsLoginRedirectUri(request.nextUrl.origin),
      state: attempt.state
    }));
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.redirect(resultUrl(request, "error"));
  }
}

function resultUrl(request: NextRequest, result: string) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  url.searchParams.set("meta", `fstats-login-${result}`);
  return url;
}

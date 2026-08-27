import { NextResponse, type NextRequest } from "next/server";

import { createCreatorSocialThreadsAuthorizationUrl, creatorSocialThreadsIntegrationKind } from "@/lib/meta/threads-oauth";
import { createFixedCallbackOAuthAttempt } from "@/lib/server/oauth-attempts";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const attempt = await createFixedCallbackOAuthAttempt({
      client: serviceClient,
      integrationKind: creatorSocialThreadsIntegrationKind,
      origin: request.nextUrl.origin,
      returnTarget: request.nextUrl.searchParams.get("return"),
      userId: user.id,
      workspaceId
    });
    return NextResponse.redirect(createCreatorSocialThreadsAuthorizationUrl(attempt.state));
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.redirect(resultUrl(request));
  }
}

function resultUrl(request: NextRequest) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  url.searchParams.set("oauth", "creator-social-threads-error");
  return url;
}

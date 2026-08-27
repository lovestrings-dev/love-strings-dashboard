import { NextResponse, type NextRequest } from "next/server";
import { createCreatorSocialInstagramAuthorizationUrl, creatorSocialInstagramIntegrationKind } from "@/lib/meta/instagram-oauth";
import { createFixedCallbackOAuthAttempt } from "@/lib/server/oauth-attempts";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    const attempt = await createFixedCallbackOAuthAttempt({ client: serviceClient, integrationKind: creatorSocialInstagramIntegrationKind, origin: request.nextUrl.origin, returnTarget: request.nextUrl.searchParams.get("return"), userId: user.id, workspaceId });
    return NextResponse.redirect(createCreatorSocialInstagramAuthorizationUrl(attempt.state));
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.redirect(resultUrl(request));
  }
}

function resultUrl(request: NextRequest) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  url.searchParams.set("oauth", "creator-social-instagram-error");
  return url;
}

import { NextResponse, type NextRequest } from "next/server";
import { createFstatsPublishingAuthorizationUrl, fstatsPublishingIntegrationKind, getFstatsLoginRedirectUri } from "@/lib/meta/fstats-login-oauth";
import { createFixedCallbackOAuthAttempt } from "@/lib/server/oauth-attempts";
import { instagramReelPublishingEnabled, selectedPublishingTarget } from "@/lib/server/instagram-reel-publishing";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    if (!instagramReelPublishingEnabled(workspaceId)) return NextResponse.json({ error: "Instagram publishing is disabled for this workspace." }, { status: 503 });
    const target = await selectedPublishingTarget(serviceClient, workspaceId);
    const attempt = await createFixedCallbackOAuthAttempt({ client: serviceClient, integrationKind: fstatsPublishingIntegrationKind, origin: request.nextUrl.origin, returnTarget: request.nextUrl.searchParams.get("return"), userId: user.id, workspaceId, context: { connectionId: target.connectionId, pageExternalId: target.pageExternalId, instagramExternalId: target.instagramExternalId } });
    return NextResponse.redirect(createFstatsPublishingAuthorizationUrl({ redirectUri: getFstatsLoginRedirectUri(request.nextUrl.origin), state: attempt.state }));
  } catch (error) { return NextResponse.json({ error: error instanceof WorkspaceAccessError || error instanceof Error ? error.message : "Publishing authorization could not start." }, { status: error instanceof WorkspaceAccessError ? error.status : 400 }); }
}

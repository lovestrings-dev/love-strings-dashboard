import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOAuthReturnOrigin, getSafeOAuthReturnPath } from "@/lib/oauth-attempt";
import { exchangeFstatsLoginAuthorizationCode, fetchFstatsLoginAuthorizationUserId, fetchFstatsLoginGrantedScopes, fstatsPublishingIntegrationKind, getFstatsLoginRedirectUri } from "@/lib/meta/fstats-login-oauth";
import { consumeFixedCallbackOAuthAttempt, OAuthAttemptError } from "@/lib/server/oauth-attempts";
import { instagramReelPublishingEnabled, savePublishingAuthorization } from "@/lib/server/instagram-reel-publishing";
import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  let attempt: Awaited<ReturnType<typeof consumeFixedCallbackOAuthAttempt>> | null = null;
  try {
    attempt = await consumeFixedCallbackOAuthAttempt({ expectedIntegrationKind: fstatsPublishingIntegrationKind, state: request.nextUrl.searchParams.get("state") });
    if (!instagramReelPublishingEnabled(attempt.workspaceId)) throw new Error("Instagram publishing is disabled for this workspace.");
    if (request.nextUrl.searchParams.get("error") || !request.nextUrl.searchParams.get("code")) throw new OAuthAttemptError("Meta publishing authorization was not completed.");
    const token = await exchangeFstatsLoginAuthorizationCode(request.nextUrl.searchParams.get("code")!, getFstatsLoginRedirectUri(request.nextUrl.origin));
    const [authorizationUserExternalId, grantedScopes] = await Promise.all([fetchFstatsLoginAuthorizationUserId(token.accessToken), fetchFstatsLoginGrantedScopes(token.accessToken)]);
    const context = attempt.context;
    if (typeof context.connectionId !== "string" || typeof context.pageExternalId !== "string" || typeof context.instagramExternalId !== "string") throw new Error("Publishing authorization context is invalid.");
    await savePublishingAuthorization(createServiceSupabaseClient(), { workspaceId: attempt.workspaceId, userId: attempt.userId, token, grantedScopes, authorizationUserExternalId, expectedTarget: { connectionId: context.connectionId, pageExternalId: context.pageExternalId, instagramExternalId: context.instagramExternalId } });
    return result(attempt.returnOrigin, attempt.returnPath, "enabled");
  } catch (error) {
    if (!attempt) return NextResponse.json({ error: "Meta publishing authorization could not be verified." }, { status: error instanceof OAuthAttemptError ? 400 : 500 });
    return result(attempt.returnOrigin, attempt.returnPath, "error");
  }
}
function result(origin: string, path: string, outcome: string) { const url = new URL(getSafeOAuthReturnPath(path, origin), getAllowedOAuthReturnOrigin(origin)); url.searchParams.set("meta", `instagram-publishing-${outcome}`); return NextResponse.redirect(url); }

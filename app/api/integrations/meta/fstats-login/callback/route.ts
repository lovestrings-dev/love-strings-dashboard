import { getAllowedOAuthReturnOrigin, getSafeOAuthReturnPath } from "@/lib/oauth-attempt";
import { NextResponse, type NextRequest } from "next/server";

import {
  discoverFstatsLoginFacebookPages,
  exchangeFstatsLoginAuthorizationCode,
  fetchFstatsLoginAuthorizationUserId,
  fetchFstatsLoginGrantedScopes,
  fstatsLoginConnectionKind,
  fstatsLoginIntegrationKind,
  fstatsPublishingIntegrationKind,
  getFstatsLoginRedirectUri
} from "@/lib/meta/fstats-login-oauth";
import { encryptMetaTokenPayload } from "@/lib/meta/tokens";
import { saveMetaConnection, saveMetaFacebookPageCandidates } from "@/lib/server/meta-connections";
import { runLinkedInstagramDiscovery } from "@/lib/server/meta-fstats-discovery";
import { readAuthoritativeFstatsLoginState } from "@/lib/server/meta-fstats-state";
import { consumeFixedCallbackOAuthAttempt, fixedCallbackIntegrationForState, OAuthAttemptError } from "@/lib/server/oauth-attempts";
import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  let attempt: Awaited<ReturnType<typeof consumeFixedCallbackOAuthAttempt>> | null = null;
  try {
    // Meta is registered against this existing callback for both Login for
    // Business configurations. Forward only a still-pending publishing state;
    // the handler below does not receive or consume analytics states.
    if (await fixedCallbackIntegrationForState(request.nextUrl.searchParams.get("state")) === fstatsPublishingIntegrationKind) {
      const url = new URL("/api/integrations/meta/fstats-login/publishing/callback", request.nextUrl.origin);
      request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
      return NextResponse.redirect(url);
    }
    attempt = await consumeFixedCallbackOAuthAttempt({
      expectedIntegrationKind: fstatsLoginIntegrationKind,
      state: request.nextUrl.searchParams.get("state")
    });
    if (request.nextUrl.searchParams.get("error") || !request.nextUrl.searchParams.get("code")) {
      throw new OAuthAttemptError("Meta authorization was not completed.");
    }

    const token = await exchangeFstatsLoginAuthorizationCode(
      request.nextUrl.searchParams.get("code")!,
      getFstatsLoginRedirectUri(request.nextUrl.origin)
    );
    const [authorizationUserExternalId, grantedScopes] = await Promise.all([
      fetchFstatsLoginAuthorizationUserId(token.accessToken),
      fetchFstatsLoginGrantedScopes(token.accessToken)
    ]);
    if (!authorizationUserExternalId) throw new Error("Meta authorization identity could not be verified.");

    const serviceClient = createServiceSupabaseClient();
    const connection = await saveMetaConnection(serviceClient, {
      workspaceId: attempt.workspaceId,
      connectionKind: fstatsLoginConnectionKind,
      authorizationUserExternalId,
      connectedBy: attempt.userId,
      encryptedTokenPayload: encryptMetaTokenPayload({ accessToken: token.accessToken }),
      tokenExpiresAt: token.expiresInSeconds ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString() : null,
      tokenRefreshedAt: new Date().toISOString(),
      tokenType: token.tokenType,
      grantedScopes
    });
    const pages = await discoverFstatsLoginFacebookPages(token.accessToken);
    await saveMetaFacebookPageCandidates(serviceClient, { workspaceId: attempt.workspaceId, connectionId: connection.id, pages });
    const state = await readAuthoritativeFstatsLoginState(serviceClient, attempt.workspaceId);
    if ("page" in state && state.page) {
      await runLinkedInstagramDiscovery(serviceClient, {
        workspaceId: attempt.workspaceId,
        connectionId: connection.id,
        pageExternalId: state.page.externalId,
      });
    }
    return NextResponse.redirect(resultUrl(attempt.returnOrigin, attempt.returnPath, "selection-required"));
  } catch (error) {
    if (!attempt) return NextResponse.json({ error: "Meta authorization could not be verified." }, { status: error instanceof OAuthAttemptError ? 400 : 500 });
    return NextResponse.redirect(resultUrl(attempt.returnOrigin, attempt.returnPath, "error"));
  }
}

function resultUrl(origin: string, returnPath: string, result: "selection-required" | "error") {
  const url = new URL(getSafeOAuthReturnPath(returnPath, origin), getAllowedOAuthReturnOrigin(origin));
  url.searchParams.set("meta", `fstats-login-${result}`);
  return url;
}

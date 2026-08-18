import { NextResponse, type NextRequest } from "next/server";

import {
  discoverFstatsLoginFacebookPages,
  exchangeFstatsLoginAuthorizationCode,
  fetchFstatsLoginAuthorizationUserId,
  fetchFstatsLoginGrantedScopes,
  fstatsLoginConnectionKind,
  fstatsLoginIntegrationKind,
  getFstatsLoginRedirectUri
} from "@/lib/meta/fstats-login-oauth";
import { encryptMetaTokenPayload } from "@/lib/meta/tokens";
import { saveMetaConnection, saveMetaFacebookPageCandidates } from "@/lib/server/meta-connections";
import { runLinkedInstagramDiscovery } from "@/lib/server/meta-fstats-discovery";
import { readAuthoritativeFstatsLoginState } from "@/lib/server/meta-fstats-state";
import { consumeOAuthAttempt, OAuthAttemptError } from "@/lib/server/oauth-attempts";
import { createServiceSupabaseClient, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  let returnPath = "/?settings=general";
  try {
    const attempt = await consumeOAuthAttempt(request, {
      expectedIntegrationKind: fstatsLoginIntegrationKind,
      requiredWorkspaceRole: "admin",
      state: request.nextUrl.searchParams.get("state")
    });
    returnPath = attempt.returnPath;
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
      connectedBy: attempt.user.id,
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
    return NextResponse.redirect(resultUrl(request, returnPath, "selection-required"));
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : error instanceof OAuthAttemptError ? 400 : 500;
    if (status !== 500) return NextResponse.json({ error: "Meta authorization could not be verified." }, { status });
    return NextResponse.redirect(resultUrl(request, returnPath, "error"));
  }
}

function resultUrl(request: NextRequest, returnPath: string, result: "selection-required" | "error") {
  const url = new URL(returnPath, request.nextUrl.origin);
  url.searchParams.set("meta", `fstats-login-${result}`);
  return url;
}

import { NextResponse, type NextRequest } from "next/server";
import { createOAuthResultReturnUrl } from "@/lib/oauth-attempt";
import { creatorSocialInstagramConnectionKind, creatorSocialInstagramIntegrationKind, exchangeCreatorSocialInstagramCode, fetchCreatorSocialInstagramIdentity } from "@/lib/meta/instagram-oauth";
import { encryptMetaTokenPayload } from "@/lib/meta/tokens";
import { bindCreatorSocialInstagram, CreatorSocialInstagramDuplicateError } from "@/lib/server/meta-connections";
import { consumeFixedCallbackOAuthAttempt, OAuthAttemptError } from "@/lib/server/oauth-attempts";

export async function GET(request: NextRequest) {
  let attempt: Awaited<ReturnType<typeof consumeFixedCallbackOAuthAttempt>> | null = null;
  try {
    attempt = await consumeFixedCallbackOAuthAttempt({ expectedIntegrationKind: creatorSocialInstagramIntegrationKind, state: request.nextUrl.searchParams.get("state") });
    if (request.nextUrl.searchParams.get("error") || !request.nextUrl.searchParams.get("code")) throw new OAuthAttemptError("Instagram authorization was not completed.");
    const token = await exchangeCreatorSocialInstagramCode(request.nextUrl.searchParams.get("code")!);
    const identity = await fetchCreatorSocialInstagramIdentity(token.accessToken);
    await bindCreatorSocialInstagram({ workspaceId: attempt.workspaceId, connectedBy: attempt.userId, authorizationUserExternalId: token.userId, encryptedTokenPayload: encryptMetaTokenPayload({ accessToken: token.accessToken }), tokenExpiresAt: token.expiresInSeconds ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString() : null, tokenType: token.tokenType, grantedScopes: token.grantedScopes, identity });
    return NextResponse.redirect(createOAuthResultReturnUrl({ origin: attempt.returnOrigin, returnPath: attempt.returnPath, result: "creator-social-instagram-connected" }));
  } catch (error) {
    if (!attempt) return NextResponse.json({ error: "Instagram authorization could not be verified." }, { status: error instanceof OAuthAttemptError ? 400 : 500 });
    const result = error instanceof CreatorSocialInstagramDuplicateError ? "creator-social-instagram-duplicate" : "creator-social-instagram-error";
    return NextResponse.redirect(createOAuthResultReturnUrl({ origin: attempt.returnOrigin, returnPath: attempt.returnPath, result }));
  }
}

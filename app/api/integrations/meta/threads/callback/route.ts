import { NextResponse, type NextRequest } from "next/server";

import { createOAuthResultReturnUrl } from "@/lib/oauth-attempt";
import { creatorSocialThreadsIntegrationKind, exchangeCreatorSocialThreadsCode, fetchCreatorSocialThreadsIdentity } from "@/lib/meta/threads-oauth";
import { encryptMetaTokenPayload } from "@/lib/meta/tokens";
import { bindCreatorSocialThreads } from "@/lib/server/meta-connections";
import { consumeFixedCallbackOAuthAttempt, OAuthAttemptError } from "@/lib/server/oauth-attempts";

export async function GET(request: NextRequest) {
  let attempt: Awaited<ReturnType<typeof consumeFixedCallbackOAuthAttempt>> | null = null;
  let stage = "callback-entered";
  const reportStage = (nextStage: string, details?: Record<string, unknown>) => console.info("threads-oauth-callback", { stage: nextStage, ...details });
  try {
    reportStage(stage);
    attempt = await consumeFixedCallbackOAuthAttempt({ expectedIntegrationKind: creatorSocialThreadsIntegrationKind, state: request.nextUrl.searchParams.get("state") });
    stage = "oauth-attempt-consumed";
    reportStage(stage);
    if (request.nextUrl.searchParams.get("error") || !request.nextUrl.searchParams.get("code")) throw new OAuthAttemptError("Threads authorization was not completed.");
    stage = "provider-code-present";
    reportStage(stage);
    const token = await exchangeCreatorSocialThreadsCode(request.nextUrl.searchParams.get("code")!, (nextStage, details) => { stage = nextStage; reportStage(stage, details); });
    const identity = await fetchCreatorSocialThreadsIdentity(token.accessToken, (nextStage) => { stage = nextStage; reportStage(stage); });
    stage = "binding-start";
    reportStage(stage);
    await bindCreatorSocialThreads({
      workspaceId: attempt.workspaceId,
      connectedBy: attempt.userId,
      authorizationUserExternalId: token.userId,
      encryptedTokenPayload: encryptMetaTokenPayload({ accessToken: token.accessToken }),
      tokenExpiresAt: token.expiresInSeconds ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString() : null,
      tokenType: token.tokenType,
      grantedScopes: token.grantedScopes,
      identity
    });
    stage = "binding-complete";
    reportStage(stage);
    return NextResponse.redirect(createOAuthResultReturnUrl({ origin: attempt.returnOrigin, returnPath: attempt.returnPath, result: "creator-social-threads-connected" }));
  } catch (error) {
    const record = error as { code?: unknown; name?: unknown; message?: unknown };
    console.error("threads-oauth-callback-failed", {
      stage,
      errorClass: typeof record?.name === "string" ? record.name : "Error",
      message: typeof record?.message === "string" ? record.message.slice(0, 300) : "Threads callback failed.",
      ...(typeof record?.code === "string" || typeof record?.code === "number" ? { code: record.code } : {})
    });
    if (!attempt) return NextResponse.json({ error: "Threads authorization could not be verified." }, { status: error instanceof OAuthAttemptError ? 400 : 500 });
    return NextResponse.redirect(createOAuthResultReturnUrl({ origin: attempt.returnOrigin, returnPath: attempt.returnPath, result: "creator-social-threads-error" }));
  }
}

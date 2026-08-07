import { NextResponse, type NextRequest } from "next/server";

import {
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode,
  fetchGoogleJson,
  isGoogleService
} from "@/lib/google/oauth";
import { requireWorkspaceAdministrator } from "@/lib/server/workspace-owner";

type GoogleUserInfo = { email?: string; sub?: string };
type YouTubeChannelsResponse = {
  items?: Array<{ id?: string; snippet?: { title?: string } }>;
};
type AnalyticsAccountSummaries = {
  accountSummaries?: Array<{
    propertySummaries?: Array<{ displayName?: string; property?: string }>;
  }>;
};

export async function GET(request: NextRequest) {
  const returnUrl = createSettingsReturnUrl(request);

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const savedState = request.cookies.get("ls_google_oauth_state")?.value;
    const service = request.cookies.get("ls_google_oauth_service")?.value ?? null;
    const savedOrigin = request.cookies.get("ls_google_oauth_origin")?.value;
    const savedWorkspaceId = request.cookies.get("ls_google_oauth_workspace")?.value;

    if (!code || !state || !savedState || state !== savedState || !isGoogleService(service)) {
      throw new Error("Google authorization session could not be verified.");
    }
    if (savedOrigin !== request.nextUrl.origin) {
      throw new Error("Google authorization returned to an unexpected app origin.");
    }

    const { serviceClient, user, workspaceId } = await requireWorkspaceAdministrator(request);
    if (!savedWorkspaceId || savedWorkspaceId !== workspaceId) {
      throw new Error("The active workspace changed during Google authorization.");
    }
    const redirectUri = `${savedOrigin}/api/integrations/google/callback`;
    const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
    const userInfo = await fetchGoogleJson<GoogleUserInfo>(
      tokens.access_token!,
      "https://openidconnect.googleapis.com/v1/userinfo"
    );

    if (!userInfo.email || !userInfo.sub) {
      throw new Error("Google did not return an account identity.");
    }

    const { data: existing, error: existingError } = await serviceClient
      .from("app_google_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.google_account_subject && existing.google_account_subject !== userInfo.sub) {
      throw new Error(`Choose the already connected Google account: ${existing.google_account_email}.`);
    }

    const encryptedRefreshToken = tokens.refresh_token
      ? encryptGoogleRefreshToken(tokens.refresh_token)
      : existing?.encrypted_refresh_token;
    if (!encryptedRefreshToken) {
      throw new Error("Google did not provide offline access. Try connecting again.");
    }

    const updates: Record<string, unknown> = {
      connected_by: user.id,
      encrypted_refresh_token: encryptedRefreshToken,
      google_account_email: userInfo.email,
      google_account_subject: userInfo.sub,
      granted_scopes: Array.from(
        new Set([
          ...((existing?.granted_scopes as string[] | null) ?? []),
          ...(tokens.scope?.split(" ").filter(Boolean) ?? [])
        ])
      ),
      workspace_id: workspaceId
    };

    if (service === "youtube") {
      const channelData = await fetchGoogleJson<YouTubeChannelsResponse>(
        tokens.access_token!,
        "https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true"
      );
      const channel = channelData.items?.[0];
      if (!channel?.id) throw new Error("No YouTube channel was found for this Google account.");
      updates.youtube_enabled = true;
      updates.youtube_channel_id = channel.id;
      updates.youtube_channel_title = channel.snippet?.title ?? "YouTube channel";
    } else {
      const summaries = await fetchGoogleJson<AnalyticsAccountSummaries>(
        tokens.access_token!,
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200"
      );
      const properties =
        summaries.accountSummaries?.flatMap((account) => account.propertySummaries ?? []) ?? [];
      const property =
        properties.find((item) =>
          item.displayName?.toLowerCase().includes("lovestrings.at")
        ) ?? (properties.length === 1 ? properties[0] : undefined);
      if (!property?.property) {
        throw new Error("The www.lovestrings.at Analytics property was not found.");
      }
      updates.analytics_enabled = true;
      updates.analytics_property_id = property.property.replace("properties/", "");
      updates.analytics_property_name = property.displayName ?? "www.lovestrings.at";
    }

    const { error: upsertError } = await serviceClient
      .from("app_google_connections")
      .upsert(updates, { onConflict: "workspace_id" });
    if (upsertError) throw upsertError;

    return clearOAuthCookies(NextResponse.redirect(setResult(returnUrl, "connected")));
  } catch (error) {
    return clearOAuthCookies(
      NextResponse.redirect(
        setResult(
          returnUrl,
          "error",
          error instanceof Error ? error.message : "Google connection failed."
        )
      )
    );
  }
}

function createSettingsReturnUrl(request: NextRequest) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("settings", "general");
  return url;
}

function setResult(url: URL, result: string, message?: string) {
  url.searchParams.set("google", result);
  if (message) url.searchParams.set("google_message", message.slice(0, 240));
  return url;
}

function clearOAuthCookies(response: NextResponse) {
  for (const name of [
    "ls_google_oauth_state",
    "ls_google_oauth_service",
    "ls_google_oauth_origin",
    "ls_google_oauth_workspace"
  ]) {
    response.cookies.set(name, "", { maxAge: 0, path: "/api/integrations/google" });
  }
  return response;
}

import { NextResponse, type NextRequest } from "next/server";

import {
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode,
  fetchGoogleJson,
  isGoogleService
} from "@/lib/google/oauth";
import { requireWorkspaceAdministrator } from "@/lib/server/workspace-owner";
import { reconcilePlatformAccount } from "@/lib/server/platform-accounts";
import { collectAfterConnection } from "@/lib/metrics/post-connection-collection";

type GoogleUserInfo = { email?: string; sub?: string };
type YouTubeChannelsResponse = {
  items?: Array<{ id?: string; snippet?: { title?: string } }>;
};
type AnalyticsAccountSummaries = {
  accountSummaries?: Array<{
    propertySummaries?: Array<{ displayName?: string; property?: string }>;
  }>;
};
type AnalyticsDataStreams = { dataStreams?: Array<{ type?: string; webStreamData?: { defaultUri?: string } }> };

export async function GET(request: NextRequest) {
  const guidanceReturn = request.cookies.get("ls_google_oauth_guidance")?.value === "1";
  const guidancePreview = request.cookies.get("ls_google_oauth_guidance_preview")?.value;
  const settingsReturnUrl = createSettingsReturnUrl(request);

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const providerError = request.nextUrl.searchParams.get("error");
    const providerErrorDescription = request.nextUrl.searchParams.get("error_description");
    const savedState = request.cookies.get("ls_google_oauth_state")?.value;
    const service = request.cookies.get("ls_google_oauth_service")?.value ?? null;
    const savedOrigin = request.cookies.get("ls_google_oauth_origin")?.value;
    const savedWorkspaceId = request.cookies.get("ls_google_oauth_workspace")?.value;

    if (!state || !savedState || state !== savedState || !isGoogleService(service)) {
      throw new Error("Google authorization session could not be verified.");
    }
    if (savedOrigin !== request.nextUrl.origin) {
      throw new Error("Google authorization returned to an unexpected app origin.");
    }
    if (providerError) {
      throw new Error(
        providerErrorDescription ||
          (providerError === "access_denied"
            ? "Google authorization was cancelled or permission was denied."
            : "Google authorization did not complete.")
      );
    }
    if (!code) {
      throw new Error("Google did not return an authorization code.");
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

    let analyticsNeedsSelection = false;
    let selectedAnalyticsProperty: { id: string; name: string } | null = null;
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
      const property = properties.length === 1 ? properties[0] : undefined;
      if (!property?.property) {
        if (!properties.length) throw new Error("No accessible Google Analytics property was found for this Google account.");
        analyticsNeedsSelection = true;
      } else {
        updates.analytics_enabled = true;
        updates.analytics_property_id = property.property.replace("properties/", "");
        updates.analytics_property_name = property.displayName ?? "Google Analytics";
        selectedAnalyticsProperty = { id: String(updates.analytics_property_id), name: String(updates.analytics_property_name) };
      }
    }

    const { error: upsertError } = await serviceClient
      .from("app_google_connections")
      .upsert(updates, { onConflict: "workspace_id" });
    if (upsertError) throw upsertError;

    if (service === "youtube") {
      await reconcilePlatformAccount(serviceClient, {
        workspaceId, platformSlug: "youtube", externalId: String(updates.youtube_channel_id),
        accountName: String(updates.youtube_channel_title),
        url: `https://www.youtube.com/channel/${updates.youtube_channel_id}`
      });
      await collectAfterConnection(workspaceId, ["youtube"]);
    }
    if (selectedAnalyticsProperty) {
      const streams = await fetchGoogleJson<AnalyticsDataStreams>(tokens.access_token!, `https://analyticsadmin.googleapis.com/v1beta/properties/${selectedAnalyticsProperty.id}/dataStreams`);
      const webUris = (streams.dataStreams ?? []).filter((stream) => stream.type === "WEB_DATA_STREAM" && stream.webStreamData?.defaultUri).map((stream) => stream.webStreamData!.defaultUri!);
      await reconcilePlatformAccount(serviceClient, { workspaceId, platformSlug: "google-analytics", externalId: selectedAnalyticsProperty.id, accountName: selectedAnalyticsProperty.name, url: webUris.length === 1 ? webUris[0] : undefined });
      await collectAfterConnection(workspaceId, ["google-analytics"]);
    }

    return clearOAuthCookies(NextResponse.redirect(setResult(guidanceReturn ? createGuidanceDashboardReturnUrl(request, guidancePreview) : settingsReturnUrl, analyticsNeedsSelection ? "select-analytics" : "connected")));
  } catch (error) {
    return clearOAuthCookies(
      NextResponse.redirect(
        setResult(
          settingsReturnUrl,
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

function createGuidanceDashboardReturnUrl(request: NextRequest, guidancePreview?: string) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("guidance_return", "google-connected");
  if (
    process.env.NODE_ENV === "development" &&
    (request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1") &&
    guidancePreview === "google"
  ) {
    url.searchParams.set("guidancePreview", "invite-member");
  }
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
    "ls_google_oauth_workspace",
    "ls_google_oauth_guidance",
    "ls_google_oauth_guidance_preview"
  ]) {
    response.cookies.set(name, "", { maxAge: 0, path: "/api/integrations/google" });
  }
  return response;
}

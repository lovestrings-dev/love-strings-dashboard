import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { reconcilePlatformAccount } from "@/lib/server/platform-accounts";

type Candidate = { channelId: string; channelTitle: string; caution: boolean; sameAsMain: boolean };

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return json({ error: "Unauthorized request." }, 401);
    const payload = (await request.json()) as { action?: "check" | "confirm"; topicChannel?: string; candidate?: Candidate };
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { data: connection, error } = await serviceClient.from("app_google_connections").select("youtube_channel_id, youtube_channel_title").eq("workspace_id", workspaceId).maybeSingle();
    if (error) throw error;
    if (!connection?.youtube_channel_id) return json({ error: "Connect your main YouTube Channel first, then add a separate Topic channel if you have one." }, 400);
    if (payload.action === "confirm") {
      const candidate = payload.candidate;
      if (!candidate?.channelId || candidate.sameAsMain || candidate.channelId === connection.youtube_channel_id) return json({ error: "Choose a separate Topic channel before confirming." }, 400);
      const { error: updateError } = await serviceClient.from("app_google_connections").update({ youtube_topic_channel_id: candidate.channelId, youtube_topic_channel_title: candidate.channelTitle }).eq("workspace_id", workspaceId);
      if (updateError) throw updateError;
      await reconcilePlatformAccount(serviceClient, { workspaceId, platformSlug: "youtube-music", externalId: candidate.channelId, accountName: candidate.channelTitle, url: `https://www.youtube.com/channel/${candidate.channelId}` });
      return json({ ...candidate, status: "configured" });
    }
    const channelId = resolveChannelId(payload.topicChannel ?? "");
    if (!channelId) return json({ error: "Enter a YouTube channel URL or channel ID." }, 400);
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return json({ error: "YouTube API is not configured." }, 503);
    const url = new URL("https://www.googleapis.com/youtube/v3/channels"); url.searchParams.set("key", apiKey); url.searchParams.set("id", channelId); url.searchParams.set("part", "id,snippet");
    const response = await fetch(url); const result = await response.json() as { items?: Array<{ id?: string; snippet?: { title?: string } }> }; const channel = result.items?.[0];
    if (!response.ok || !channel?.id) return json({ error: "YouTube channel was not found." }, 400);
    const { data: workspace } = await serviceClient.from("app_workspaces").select("name").eq("id", workspaceId).maybeSingle();
    const title = channel.snippet?.title ?? "YouTube Topic";
    const matches = [workspace?.name, connection.youtube_channel_title].filter(Boolean).some((name) => title.toLowerCase().includes(String(name).toLowerCase()) || String(name).toLowerCase().includes(title.toLowerCase().replace(/\s*-\s*topic$/i, "")));
    return json({ channelId: channel.id, channelTitle: title, canonicalUrl: `https://www.youtube.com/channel/${channel.id}`, caution: !matches, sameAsMain: channel.id === connection.youtube_channel_id });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Topic configuration failed." }, error instanceof WorkspaceAccessError ? error.status : 500); }
}
function json(body: unknown, status = 200) { return NextResponse.json(body, { status }); }
function resolveChannelId(value: string) { const match = value.trim().match(/(UC[\w-]{22})/); return match?.[1] ?? null; }
function sameOrigin(request: NextRequest) { const origin=request.headers.get("origin"), host=request.headers.get("host"); try { return Boolean(origin && host && new URL(origin).host === host); } catch { return false; } }

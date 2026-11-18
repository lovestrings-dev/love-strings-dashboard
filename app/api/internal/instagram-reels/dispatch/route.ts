import { NextResponse, type NextRequest } from "next/server";
import { dispatchOneInstagramReel, instagramReelPublishingTestWorkspaceIds } from "@/lib/server/instagram-reel-publishing";
import { runInternalInstagramReelDispatch } from "@/lib/server/internal-instagram-reel-dispatch";
import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const result = await runInternalInstagramReelDispatch({
    receivedSecret: request.headers.get("x-artistdeck-dispatch-secret"), expectedSecret: process.env.INSTAGRAM_REEL_DISPATCH_SECRET,
    publishingEnabled: process.env.INSTAGRAM_REEL_PUBLISHING_ENABLED === "true" && instagramReelPublishingTestWorkspaceIds().size > 0, automaticEnabled: process.env.INSTAGRAM_REEL_AUTOMATIC_DISPATCH_ENABLED === "true",
    dispatch: async () => {
      const client = createServiceSupabaseClient();
      const results = [];
      for (const workspaceId of instagramReelPublishingTestWorkspaceIds()) results.push(await dispatchOneInstagramReel(client, workspaceId));
      return { results };
    }
  });
  return NextResponse.json(result.body, { status: result.status });
}

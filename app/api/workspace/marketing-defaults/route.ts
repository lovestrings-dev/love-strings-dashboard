import { NextResponse, type NextRequest } from "next/server";
import { fallbackMarketingTimingDefaults, validateMarketingTimingDefaults } from "@/lib/marketing-defaults";
import { requireWorkspaceAccess, requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

function reply(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function mapSettings(row: Record<string, unknown>) {
  return {
    songCampaignLengthDays: Number(row.marketing_song_campaign_length_days ?? fallbackMarketingTimingDefaults.songCampaignLengthDays),
    songCampaignAdvanceDays: Number(row.marketing_song_campaign_advance_days ?? fallbackMarketingTimingDefaults.songCampaignAdvanceDays),
    generalCampaignLengthDays: Number(row.marketing_general_campaign_length_days ?? fallbackMarketingTimingDefaults.generalCampaignLengthDays)
  };
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("app_workspace_settings")
      .select("marketing_song_campaign_length_days, marketing_song_campaign_advance_days, marketing_general_campaign_length_days")
      .eq("workspace_id", workspaceId).single();
    if (error) throw error;
    return reply({ defaults: mapSettings(data) });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Marketing defaults unavailable." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin"); const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return reply({ error: "Unauthorized request." }, { status: 401 });
    const defaults = await request.json();
    if (!validateMarketingTimingDefaults(defaults)) {
      return reply({ error: "Campaign lengths must be positive whole days, and pre-release promotion must be from 0 through one day before the Song Campaign length." }, { status: 400 });
    }
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const { error } = await serviceClient.from("app_workspace_settings").update({
      marketing_song_campaign_length_days: defaults.songCampaignLengthDays,
      marketing_song_campaign_advance_days: defaults.songCampaignAdvanceDays,
      marketing_general_campaign_length_days: defaults.generalCampaignLengthDays
    }).eq("workspace_id", workspaceId);
    if (error) throw error;
    return reply({ defaults, status: "updated" });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Marketing defaults update failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

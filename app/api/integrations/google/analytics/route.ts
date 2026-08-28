import { NextResponse, type NextRequest } from "next/server";
import { decryptGoogleRefreshToken, fetchGoogleJson, refreshGoogleAccessToken } from "@/lib/google/oauth";
import { reconcilePlatformAccount } from "@/lib/server/platform-accounts";
import { requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";
import { collectAfterConnection } from "@/lib/metrics/post-connection-collection";

type Summary = { accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }> };
export async function GET(request: NextRequest) {
  try { const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request); const connection = await connectionFor(serviceClient, workspaceId); const token = await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.encrypted_refresh_token)); const data = await fetchGoogleJson<Summary>(token, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200"); return NextResponse.json({ properties: (data.accountSummaries ?? []).flatMap(a => a.propertySummaries ?? []).filter(p => p.property).map(p => ({ id: p.property!.replace("properties/", ""), name: p.displayName ?? "Google Analytics" })) }); } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request); const payload = await request.json() as { propertyId?: string };
    if (!payload.propertyId) return NextResponse.json({ error: "Choose an Analytics property." }, { status: 400 });
    const connection = await connectionFor(serviceClient, workspaceId); const token = await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.encrypted_refresh_token));
    const data = await fetchGoogleJson<Summary>(token, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
    const property = (data.accountSummaries ?? []).flatMap(a => a.propertySummaries ?? []).find(p => p.property === `properties/${payload.propertyId}`);
    if (!property) return NextResponse.json({ error: "That Analytics property is not accessible through the connected Google account." }, { status: 400 });
    const name = property.displayName ?? "Google Analytics";
    const { error } = await serviceClient.from("app_google_connections").update({ analytics_enabled: true, analytics_property_id: payload.propertyId, analytics_property_name: name }).eq("workspace_id", workspaceId); if (error) throw error;
    await reconcilePlatformAccount(serviceClient, { workspaceId, platformSlug: "google-analytics", externalId: payload.propertyId, accountName: name });
    await collectAfterConnection(workspaceId, ["google-analytics"]);
    return NextResponse.json({ status: "connected", property: { id: payload.propertyId, name } });
  } catch (error) { return failure(error); }
}
async function connectionFor(client: any, workspaceId: string) { const { data, error } = await client.from("app_google_connections").select("encrypted_refresh_token").eq("workspace_id", workspaceId).maybeSingle(); if (error) throw error; if (!data?.encrypted_refresh_token) throw new Error("Connect Google Analytics first."); return data; }
function sameOrigin(request: NextRequest) { try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; } }
function failure(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics configuration failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }

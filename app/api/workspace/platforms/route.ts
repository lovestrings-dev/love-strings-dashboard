import { NextResponse, type NextRequest } from "next/server";
import { configurablePlatformSlugs, saveManualPlatformUrl } from "@/lib/server/platform-accounts";
import { requireWorkspaceAccess, requireWorkspaceAdministrator, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient.from("platform_accounts")
      .select("url, external_id, account_name, platforms!inner(slug, name)").eq("workspace_id", workspaceId);
    if (error) throw error;
    const accounts = (data ?? []).map((row: any) => ({ slug: row.platforms.slug, name: row.account_name, externalId: row.external_id, url: row.url }));
    return NextResponse.json({ accounts });
  } catch (error) { return failure(error, "Platform configuration load failed."); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = await request.json() as { slug?: string; url?: string };
    if (!payload.slug || !configurablePlatformSlugs.includes(payload.slug as any)) return NextResponse.json({ error: "This platform URL is not manually configurable." }, { status: 400 });
    let url = (payload.url ?? "").trim();
    if (url) { try { url = new URL(url).toString(); } catch { return NextResponse.json({ error: "Enter a valid public URL." }, { status: 400 }); } }
    await saveManualPlatformUrl(serviceClient, workspaceId, payload.slug, url);
    return NextResponse.json({ status: "saved" });
  } catch (error) { return failure(error, "Platform configuration save failed."); }
}
function sameOrigin(request: NextRequest) { try { return Boolean(request.headers.get("origin") && request.headers.get("host") && new URL(request.headers.get("origin")!).host === request.headers.get("host")); } catch { return false; } }
function failure(error: unknown, fallback: string) { return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: error instanceof WorkspaceAccessError ? error.status : 500 }); }

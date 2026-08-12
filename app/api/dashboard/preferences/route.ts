import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeDashboardCardIds,
  resolveDashboardPreferences
} from "@/lib/dashboard-preferences";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

type PreferenceRow = { card_order: unknown; visible_cards: unknown };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    const preferences = await loadPreferences(serviceClient, workspaceId, user.id);
    return response(preferences);
  } catch (error) {
    return failure(error, "Dashboard preferences load failed.");
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginWrite(request)) return response({ error: "Unauthorized." }, 401);
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    const body = (await request.json()) as { cardOrder?: unknown; visibleCards?: unknown };
    if (!Array.isArray(body.cardOrder) || !Array.isArray(body.visibleCards)) {
      return response({ error: "cardOrder and visibleCards must be arrays." }, 400);
    }
    const requestedCardOrder = normalizeDashboardCardIds(body.cardOrder);
    if (!requestedCardOrder.length) {
      return response({ error: "Use reset to restore the canonical Dashboard preset." }, 400);
    }
    const visibleCards = normalizeDashboardCardIds(body.visibleCards);
    // Persist a complete resolved order once customization starts. This makes a
    // card's absence from a later saved order an unambiguous future-card signal.
    const resolved = resolveDashboardPreferences({
      cardOrder: requestedCardOrder,
      visibleCards
    });
    const cardOrder = resolved.cardOrder;
    const { error } = await serviceClient.from("dashboard_preferences").upsert(
      { card_order: cardOrder, user_id: user.id, visible_cards: visibleCards, workspace_id: workspaceId },
      { onConflict: "workspace_id,user_id" }
    );
    if (error) throw error;
    return response({ preferences: { cardOrder, visibleCards }, resolved });
  } catch (error) {
    return failure(error, "Dashboard preferences save failed.");
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginWrite(request)) return response({ error: "Unauthorized." }, 401);
  try {
    const { serviceClient, user, workspaceId } = await requireWorkspaceAccess(request);
    const { error } = await serviceClient.from("dashboard_preferences").upsert(
      { card_order: [], user_id: user.id, visible_cards: [], workspace_id: workspaceId },
      { onConflict: "workspace_id,user_id" }
    );
    if (error) throw error;
    return response({ preferences: { cardOrder: [], visibleCards: [] }, resolved: resolveDashboardPreferences() });
  } catch (error) {
    return failure(error, "Dashboard preferences reset failed.");
  }
}

async function loadPreferences(serviceClient: Awaited<ReturnType<typeof requireWorkspaceAccess>>["serviceClient"], workspaceId: string, userId: string) {
  const { data, error } = await serviceClient
    .from("dashboard_preferences")
    .select("card_order, visible_cards")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = data as PreferenceRow | null;
  const cardOrder = normalizeDashboardCardIds(row?.card_order);
  const visibleCards = normalizeDashboardCardIds(row?.visible_cards);
  return { preferences: { cardOrder, visibleCards }, resolved: resolveDashboardPreferences({ cardOrder, visibleCards }) };
}

function isSameOriginWrite(request: NextRequest) {
  if (request.headers.get("x-love-strings-dashboard") !== "write") return false;
  const host = request.headers.get("host");
  if (!host) return false;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  const origin = request.headers.get("origin");
  if (origin) return new URL(origin).host === host;
  const referer = request.headers.get("referer");
  return referer ? new URL(referer).host === host : false;
}

function response(body: object, status = 200) {
  const result = NextResponse.json(body, { status });
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  return result;
}

function failure(error: unknown, fallback: string) {
  const status = error instanceof WorkspaceAccessError ? error.status : 500;
  return response({ error: error instanceof Error ? error.message : fallback }, status);
}

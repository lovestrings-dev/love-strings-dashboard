import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeDashboardCardIds,
  resolveDashboardPreferences
} from "@/lib/dashboard-preferences";
import { requirePlatformOwner, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const templateKey = "new-member-dashboard";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient } = await requirePlatformOwner(request);
    const { data, error } = await serviceClient
      .from("platform_dashboard_preference_templates")
      .select("template_key, version, visible_cards, card_order, theme, effective_at")
      .eq("template_key", templateKey)
      .is("retired_at", null)
      .single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  try {
    const { serviceClient } = await requirePlatformOwner(request);
    const body = await request.json() as { cardOrder?: unknown; theme?: unknown; visibleCards?: unknown };
    if (!Array.isArray(body.cardOrder) || !Array.isArray(body.visibleCards) || (body.theme !== "light" && body.theme !== "dark")) {
      return NextResponse.json({ error: "cardOrder, visibleCards, and theme are required." }, { status: 400 });
    }
    const requestedOrder = normalizeDashboardCardIds(body.cardOrder);
    if (!requestedOrder.length) return NextResponse.json({ error: "A template needs a card order." }, { status: 400 });
    const resolved = resolveDashboardPreferences({ cardOrder: requestedOrder, visibleCards: normalizeDashboardCardIds(body.visibleCards) });
    const { data, error } = await serviceClient.rpc("activate_platform_dashboard_preference_template", {
      p_card_order: resolved.cardOrder,
      p_theme: body.theme,
      p_visible_cards: resolved.visibleCards
    });
    if (error) throw error;
    return NextResponse.json({ template: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    return failure(error);
  }
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function failure(error: unknown) {
  const status = error instanceof WorkspaceAccessError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Platform dashboard template request failed." }, { status });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

export const dynamic = "force-dynamic";

const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validSlug.test(slug)) return NextResponse.json({ error: "Invalid Smart Link." }, { status: 400 });

  try {
    const body = await request.json() as { destinationId?: unknown; type?: unknown };
    const client = createServiceSupabaseClient();
    const rpc = body.type === "page_view"
      ? client.rpc("increment_smart_link_page_view", { p_public_slug: slug })
      : body.type === "destination_click" && typeof body.destinationId === "string" && validUuid.test(body.destinationId)
        ? client.rpc("increment_smart_link_destination_click", { p_public_slug: slug, p_destination_id: body.destinationId })
        : null;
    if (!rpc) return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
    const { error } = await rpc;
    if (error) return NextResponse.json({ error: "Analytics event was rejected." }, { status: 404 });
    return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }
}

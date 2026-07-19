import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!hasValidAppAccess(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      albumArtUrl?: string;
      releaseDate?: string;
      slug?: string;
      title?: string;
    };
    const title = normalizeText(payload.title, 200);
    const slug = normalizeText(payload.slug, 240);

    if (!title || !slug || !isIsoDate(payload.releaseDate)) {
      return NextResponse.json({ error: "Campaign data is invalid." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        album_art_url: normalizeText(payload.albumArtUrl, 2000),
        release_date: payload.releaseDate,
        slug,
        source: "app",
        status: "planned",
        title
      })
      .select("id, slug")
      .single();

    if (error) throw error;
    return NextResponse.json({ campaign: data, status: "ok" });
  } catch (error) {
    return errorResponse(error, "Marketing campaign creation failed.");
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasValidAppAccess(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      campaignId?: string;
      updates?: { albumArtUrl?: string; releaseDate?: string; title?: string };
    };

    if (!isUuid(payload.campaignId) || !payload.updates) {
      return NextResponse.json({ error: "Campaign update is invalid." }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (payload.updates.albumArtUrl !== undefined) {
      updates.album_art_url = normalizeText(payload.updates.albumArtUrl, 2000);
    }
    if (payload.updates.releaseDate !== undefined) {
      if (!isIsoDate(payload.updates.releaseDate)) {
        return NextResponse.json({ error: "Release date is invalid." }, { status: 400 });
      }
      updates.release_date = payload.updates.releaseDate;
    }
    if (payload.updates.title !== undefined) {
      const title = normalizeText(payload.updates.title, 200);
      if (!title) {
        return NextResponse.json({ error: "Campaign title is required." }, { status: 400 });
      }
      updates.title = title;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase
      .from("marketing_campaigns")
      .update(updates)
      .eq("id", payload.campaignId);

    if (error) throw error;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Marketing campaign update failed.");
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasValidAppAccess(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { campaignId?: string };
    if (!isUuid(payload.campaignId)) {
      return NextResponse.json({ error: "Campaign id is invalid." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", payload.campaignId);

    if (error) throw error;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error, "Marketing campaign deletion failed.");
  }
}

function hasValidAppAccess(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return process.env.NODE_ENV === "development";

  const expectedAuthorization = `Basic ${Buffer.from(
    `${expectedUser}:${expectedPassword}`
  ).toString("base64")}`;
  return request.headers.get("authorization") === expectedAuthorization;
}

function isSameOriginWrite(request: NextRequest) {
  if (request.headers.get("x-love-strings-marketing") !== "write") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!host) return false;
  if (fetchSite === "same-origin") return true;
  if (origin) return new URL(origin).host === host;
  if (referer) return new URL(referer).host === host;
  return false;
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isIsoDate(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isUuid(value?: string): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

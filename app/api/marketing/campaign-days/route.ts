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
      campaignId?: string;
      days?: unknown[];
    };

    if (!isUuid(payload.campaignId) || !Array.isArray(payload.days)) {
      return NextResponse.json(
        { error: "Campaign save payload is invalid." },
        { status: 400 }
      );
    }

    if (payload.days.length > 100) {
      return NextResponse.json({ error: "Campaign has too many days." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.rpc("replace_marketing_campaign_days", {
      p_campaign_id: payload.campaignId,
      p_days: payload.days
    });

    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Marketing campaign save failed.") },
      { status: 500 }
    );
  }
}

function hasValidAppAccess(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return process.env.NODE_ENV === "development";
  }

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

function isUuid(value?: string): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

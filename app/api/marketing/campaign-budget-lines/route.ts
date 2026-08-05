import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BudgetLinePayload = { amount?: unknown; description?: unknown; id?: unknown };

export async function POST(request: NextRequest) {
  if (!hasValidAppAccess(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      campaignId?: string;
      lines?: BudgetLinePayload[];
    };

    if (!isUuid(payload.campaignId) || !Array.isArray(payload.lines)) {
      return NextResponse.json({ error: "Campaign budget payload is invalid." }, { status: 400 });
    }
    if (payload.lines.length > 100) {
      return NextResponse.json({ error: "Campaign has too many budget lines." }, { status: 400 });
    }

    const lines = payload.lines.map((line, position) => ({
      amount: normalizeAmount(line.amount),
      description: normalizeText(line.description, 500),
      id: normalizeId(line.id),
      position
    }));
    if (lines.some((line) => !line.id || line.amount === null)) {
      return NextResponse.json({ error: "Campaign budget line is invalid." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.rpc("replace_marketing_campaign_budget_lines", {
      p_campaign_id: payload.campaignId,
      p_lines: lines
    });
    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Marketing campaign budget save failed.") },
      { status: 500 }
    );
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

function normalizeAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && Math.abs(amount) <= 9999999999.99 ? amount : null;
}

function normalizeId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,300}$/.test(value) ? value : "";
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isUuid(value?: string): value is string {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

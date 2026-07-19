import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type QrLink = {
  id: string;
  name: string;
  qrImageUrl: string;
  targetUrl: string;
};
type QrLinkRow = {
  stable_key: string;
  name: string;
  qr_image_url: string;
  target_url: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  if (!hasValidAppAccess(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ links: await loadLinks(), status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "QR links load failed.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidAppAccess(request) || !isSameOriginWrite(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { links?: QrLink[] };
    const links = (payload.links ?? []).map(normalizeLink);

    if (links.length > 50) {
      return NextResponse.json({ error: "Too many QR links." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.rpc("replace_qr_links", {
      p_links: links.map((link, index) => ({
        name: link.name,
        position: index + 1,
        qr_image_url: link.qrImageUrl,
        stable_key: link.id,
        target_url: link.targetUrl
      }))
    });

    if (error) throw error;

    return NextResponse.json({ links: await loadLinks(), status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "QR links save failed.") },
      { status: 500 }
    );
  }
}

async function loadLinks() {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("qr_links")
    .select("stable_key, name, qr_image_url, target_url")
    .order("position", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as QrLinkRow[]).map((link) => ({
    id: link.stable_key,
    name: link.name,
    qrImageUrl: link.qr_image_url,
    targetUrl: link.target_url
  }));
}

function normalizeLink(link: QrLink): QrLink {
  const id = link.id?.trim();

  if (!id) throw new Error("QR link is missing its stable id.");

  return {
    id,
    name: typeof link.name === "string" ? link.name : "",
    qrImageUrl: typeof link.qrImageUrl === "string" ? link.qrImageUrl : "",
    targetUrl: typeof link.targetUrl === "string" ? link.targetUrl : ""
  };
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
  if (request.headers.get("x-love-strings-qr") !== "write") return false;

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

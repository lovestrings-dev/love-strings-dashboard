import { NextResponse, type NextRequest } from "next/server";
import { appearanceFromMetadata, themeCookieName } from "@/lib/appearance";
import { createServiceSupabaseClient, requireAuthenticatedUser, WorkspaceAccessError } from "@/lib/server/workspace-owner";

export const dynamic = "force-dynamic";

function response(metadata: Record<string, unknown>) {
  const appearance = appearanceFromMetadata(metadata);
  const result = NextResponse.json(appearance);
  result.headers.set("Cache-Control", "private, no-store");
  result.cookies.set(themeCookieName, appearance.theme, { path: "/", sameSite: "lax", maxAge: 31536000, httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    return response(user.user_metadata);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin || request.headers.get("x-love-strings-dashboard") !== "write") {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 403 });
  }
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "theme" && key !== "acknowledgeFeature") ||
      !("theme" in body || "acknowledgeFeature" in body) ||
      ("theme" in body && body.theme !== "dark" && body.theme !== "light") ||
      ("acknowledgeFeature" in body && body.acknowledgeFeature !== true)) {
      return NextResponse.json({ error: "Choose dark or light, or acknowledge the feature." }, { status: 400 });
    }
    // Only this authenticated user's presentation metadata can be changed.
    // Supabase merges these keys; unrelated account metadata is preserved.
    const updates = {
      ...("theme" in body ? { artistdeck_theme: body.theme } : {}),
      ...(body.acknowledgeFeature ? { artistdeck_dark_mode_v1_acknowledged: true } : {})
    };
    const { data, error } = await createServiceSupabaseClient().auth.admin.updateUserById(user.id, { user_metadata: updates });
    if (error) throw error;
    return response(data.user.user_metadata);
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const status = error instanceof WorkspaceAccessError ? error.status : 500;
  const result = NextResponse.json({ error: status === 401 ? "Sign in to save your appearance." : "Appearance could not be saved. Please try again." }, { status });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}

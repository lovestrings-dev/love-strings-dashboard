import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type WorkspaceRole = "member" | "owner" | "viewer";

const loveStringsWorkspaceId = "00000000-0000-0000-0000-000000000001";
const productionAppUrl = "https://love-strings-dashboard.vercel.app";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in again to send invitations." }, { status: 401 });
    }

    const serviceClient = createServiceSupabaseClient();
    const { data: membership, error: membershipError } = await serviceClient
      .from("app_workspace_members")
      .select("role")
      .eq("workspace_id", loveStringsWorkspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (membership?.role !== "owner") {
      return NextResponse.json(
        { error: "Only a workspace Owner can invite users." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as { email?: string; role?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = normalizeRole(payload.role);

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "Choose a valid workspace role." }, { status: 400 });
    }

    const { data: invitation, error: invitationError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: { workspace_role: role },
        redirectTo: `${getPublicAppUrl()}/set-password`
      });

    if (invitationError) {
      const message = invitationError.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        return NextResponse.json(
          { error: "This email already has an account or a pending invitation." },
          { status: 409 }
        );
      }
      throw invitationError;
    }

    if (!invitation.user) {
      throw new Error("Supabase did not return the invited user.");
    }

    const { error: roleError } = await serviceClient
      .from("app_workspace_members")
      .upsert(
        {
          role,
          user_id: invitation.user.id,
          workspace_id: loveStringsWorkspaceId
        },
        { onConflict: "workspace_id,user_id" }
      );

    if (roleError) throw roleError;

    return NextResponse.json({ email, role, status: "sent" });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Invitation could not be sent.") },
      { status: 500 }
    );
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined
    }
  });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) return null;
  return user;
}

function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase administration is not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configuredUrl || productionAppUrl).replace(/\/$/, "");
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!host) return false;
  if (fetchSite === "same-origin") return true;
  if (!origin) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function normalizeRole(value?: string): WorkspaceRole | null {
  return value === "owner" || value === "member" || value === "viewer" ? value : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
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

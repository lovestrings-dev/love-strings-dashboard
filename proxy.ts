import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  activeWorkspaceCookieName,
  parseWorkspaceId,
  resolveWorkspaceMembership
} from "@/lib/workspace";
import { isPlatformAdministrationPath } from "@/lib/platform-administration-routing";

const cronSecret = process.env.CRON_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function proxy(request: NextRequest) {
  if (
    isAuthorizedCronRefreshRequest(request) ||
    isAuthorizedVercelCronRefreshRequest(request)
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse("Authentication is not configured.", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const authenticatedUser = user;

  if (!authenticatedUser) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("app_workspace_members")
    .select("workspace_id, role, created_at")
    .eq("user_id", authenticatedUser.id)
    .order("created_at", { ascending: true });

  const requestedWorkspaceId = parseWorkspaceId(
    request.cookies.get(activeWorkspaceCookieName)?.value
  );
  const workspaceIds = (memberships ?? []).map((entry) => entry.workspace_id);
  const { data: workspaceStates, error: workspaceStateError } = workspaceIds.length
    ? await supabase.from("app_workspaces").select("id, access_state").in("id", workspaceIds)
    : { data: [], error: null };
  const activeWorkspaceIds = new Set((workspaceStates ?? []).filter((workspace) => workspace.access_state !== "frozen").map((workspace) => workspace.id));
  const membership = resolveWorkspaceMembership((memberships ?? []).filter((entry) => activeWorkspaceIds.has(entry.workspace_id)), requestedWorkspaceId);

  if (membershipError || workspaceStateError || !membership) {
    if (isPlatformAdministrationPath(request.nextUrl.pathname) && await isPlatformOperator(authenticatedUser.id)) {
      return response;
    }
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Workspace unavailable." }, { status: 423 });
    }
    if ((memberships ?? []).length > 0) { const unavailableUrl = request.nextUrl.clone(); unavailableUrl.pathname = "/workspace-unavailable"; unavailableUrl.search = ""; return NextResponse.redirect(unavailableUrl); }
    const noWorkspaceUrl = request.nextUrl.clone();
    noWorkspaceUrl.pathname = "/no-workspace";
    noWorkspaceUrl.search = "";
    return NextResponse.redirect(noWorkspaceUrl);
  }

  if (
    membership.role === "viewer" &&
    request.nextUrl.pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    return NextResponse.json(
      { error: "Viewer accounts have read-only access." },
      { status: 403 }
    );
  }

  if (request.cookies.get(activeWorkspaceCookieName)?.value !== membership.workspace_id) {
    response.cookies.set(
      activeWorkspaceCookieName,
      membership.workspace_id,
      {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:"
      }
    );
  }

  return response;
}

async function isPlatformOperator(userId: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) return false;
  const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await service
    .from("app_platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/no-workspace" ||
    pathname === "/workspace-unavailable" ||
    pathname === "/set-password" ||
    pathname === "/api/invitations/accept"
  );
}

function isAuthorizedCronRefreshRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  return Boolean(
    cronSecret &&
      request.nextUrl.pathname === "/api/metrics/refresh" &&
      authorization === `Bearer ${cronSecret}`
  );
}

function isAuthorizedVercelCronRefreshRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const cronSchedule = request.headers.get("x-vercel-cron-schedule");

  return (
    request.nextUrl.pathname === "/api/cron/metrics-refresh" &&
    userAgent.includes("vercel-cron/1.0") &&
    cronSchedule === "0 5 * * *"
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|love-strings-logo.jpeg|artistdeck-logo.png).*)"]
};

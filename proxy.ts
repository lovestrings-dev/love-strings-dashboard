import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const cronSecret = process.env.CRON_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname === "/set-password";
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|love-strings-logo.jpeg).*)"]
};

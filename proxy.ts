import { NextResponse, type NextRequest } from "next/server";

const appUser = process.env.APP_BASIC_AUTH_USER;
const appPassword = process.env.APP_BASIC_AUTH_PASSWORD;
const cronSecret = process.env.CRON_SECRET;

export function proxy(request: NextRequest) {
  if (isAuthorizedCronRefreshRequest(request)) {
    return NextResponse.next();
  }

  if (!appUser || !appPassword) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (authorization) {
    const [scheme, credentials] = authorization.split(" ");

    if (scheme === "Basic" && credentials) {
      const [username, password] = atob(credentials).split(":");

      if (username === appUser && password === appPassword) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required.", {
    headers: {
      "WWW-Authenticate": 'Basic realm="Love Strings Dashboard"'
    },
    status: 401
  });
}

function isAuthorizedCronRefreshRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  return Boolean(
    cronSecret &&
      request.nextUrl.pathname === "/api/metrics/refresh" &&
      authorization === `Bearer ${cronSecret}`
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

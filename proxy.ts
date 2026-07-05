import { NextResponse, type NextRequest } from "next/server";

const appUser = process.env.APP_BASIC_AUTH_USER;
const appPassword = process.env.APP_BASIC_AUTH_PASSWORD;

export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

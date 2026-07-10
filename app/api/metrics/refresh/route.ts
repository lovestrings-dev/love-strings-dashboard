import { NextResponse, type NextRequest } from "next/server";

import { refreshAllMetricCollectors } from "@/lib/metrics/collectors";

export async function GET(request: NextRequest) {
  if (!isAuthorizedRefreshRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshAllMetricCollectors();
  return NextResponse.json({ ...result, status: "ok" });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRefreshRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshAllMetricCollectors();
  return NextResponse.json({ ...result, status: "ok" });
}

function isAuthorizedRefreshRequest(request: NextRequest) {
  return (
    isAuthorizedCronRequest(request) ||
    isAuthorizedBasicAuthRequest(request) ||
    isAuthorizedManualRefreshRequest(request)
  );
}

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(
    cronSecret &&
      authorization &&
      authorization === `Bearer ${cronSecret}`
  );
}

function isAuthorizedBasicAuthRequest(request: NextRequest) {
  const appUser = process.env.APP_BASIC_AUTH_USER;
  const appPassword = process.env.APP_BASIC_AUTH_PASSWORD;
  const authorization = request.headers.get("authorization");

  if (!appUser || !appPassword || !authorization) {
    return false;
  }

  const [scheme, credentials] = authorization.split(" ");

  if (scheme !== "Basic" || !credentials) {
    return false;
  }

  const [username, password] = atob(credentials).split(":");
  return username === appUser && password === appPassword;
}

function isAuthorizedManualRefreshRequest(request: NextRequest) {
  if (
    request.method !== "POST" ||
    request.headers.get("x-love-strings-refresh") !== "manual"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return false;
  }

  return new URL(origin).host === host;
}

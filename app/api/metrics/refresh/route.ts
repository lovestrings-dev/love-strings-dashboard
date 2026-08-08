import { NextResponse, type NextRequest } from "next/server";

import { refreshAllMetricCollectors } from "@/lib/metrics/collectors";
import { requireWorkspaceAccess } from "@/lib/server/workspace-owner";

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

  const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
  const { data: configuredAccount, error: accountError } = await serviceClient
    .from("platform_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();
  if (accountError) {
    return NextResponse.json({ error: "Metric configuration check failed." }, { status: 500 });
  }
  if (!configuredAccount) {
    return NextResponse.json({
      results: [],
      skipped: true,
      status: "ok"
    });
  }
  const result = await refreshAllMetricCollectors(workspaceId);
  return NextResponse.json({ ...result, status: "ok" });
}

function isAuthorizedRefreshRequest(request: NextRequest) {
  return (
    isAuthorizedCronRequest(request) ||
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

import { NextResponse, type NextRequest } from "next/server";

import { refreshAllMetricCollectors } from "@/lib/metrics/collectors";

export async function GET(request: NextRequest) {
  if (!isAuthorizedVercelCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshAllMetricCollectors();
  const updatedCollectors = result.results.filter(
    (collector) => collector.status === "fulfilled"
  ).length;
  const failedCollectors = result.results.filter(
    (collector) => collector.status === "rejected"
  ).length;

  return NextResponse.json({
    failedCollectors,
    status: failedCollectors > 0 ? "partial" : "ok",
    updatedCollectors
  });
}

export function isAuthorizedVercelCronRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const cronSchedule = request.headers.get("x-vercel-cron-schedule");

  return userAgent.includes("vercel-cron/1.0") && cronSchedule === "0 5 * * *";
}

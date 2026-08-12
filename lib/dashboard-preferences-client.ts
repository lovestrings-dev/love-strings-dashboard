import type { DashboardCardId, ResolvedDashboardPreferences } from "@/lib/dashboard-preferences";

type DashboardPreferencesResponse = {
  preferences: { cardOrder: DashboardCardId[]; visibleCards: DashboardCardId[] };
  resolved: ResolvedDashboardPreferences;
};

export async function loadDashboardPreferences() {
  return requestDashboardPreferences("GET");
}

export async function saveDashboardPreferences(input: {
  cardOrder: DashboardCardId[];
  visibleCards: DashboardCardId[];
}) {
  return requestDashboardPreferences("PUT", input);
}

export async function resetDashboardPreferences() {
  // Keep the same explicit write shape as saves so the request retains the
  // same-origin write header through all browser fetch implementations.
  return requestDashboardPreferences("DELETE", { cardOrder: [], visibleCards: [] });
}

async function requestDashboardPreferences(
  method: "GET" | "PUT" | "DELETE",
  body?: { cardOrder: DashboardCardId[]; visibleCards: DashboardCardId[] }
) {
  const response = await fetch("/api/dashboard/preferences", {
    body: body ? JSON.stringify(body) : undefined,
    headers: method === "GET" ? undefined : {
      "content-type": "application/json",
      "x-love-strings-dashboard": "write"
    },
    method
  });
  const payload = (await response.json().catch(() => null)) as DashboardPreferencesResponse & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload?.error ?? "Dashboard preferences request failed.");
  return payload;
}

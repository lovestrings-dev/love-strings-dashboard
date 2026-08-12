export const dashboardCardRegistry = [
  { id: "events", label: "Events", visibleByDefault: true },
  { id: "focus", label: "Focus Queue", visibleByDefault: true },
  { id: "platforms", label: "Platforms", visibleByDefault: true },
  { id: "platforms.audience", label: "Audience", parentId: "platforms", visibleByDefault: true },
  { id: "platforms.instagram", label: "Instagram", parentId: "platforms", visibleByDefault: true },
  { id: "platforms.youtube", label: "YouTube Channel", parentId: "platforms", visibleByDefault: true },
  { id: "platforms.youtube-topic", label: "YouTube Topic", parentId: "platforms", visibleByDefault: true },
  { id: "platforms.youtube-music", label: "YouTube Music", parentId: "platforms", visibleByDefault: false },
  { id: "platforms.apple-music", label: "Apple Music", parentId: "platforms", visibleByDefault: true },
  { id: "platforms.spotify", label: "Spotify", parentId: "platforms", visibleByDefault: false },
  { id: "platforms.deezer", label: "Deezer", parentId: "platforms", visibleByDefault: false },
  { id: "platforms.amazon", label: "Amazon", parentId: "platforms", visibleByDefault: false },
  { id: "platforms.website", label: "Website", parentId: "platforms", visibleByDefault: true },
  { id: "marketing", label: "Marketing", visibleByDefault: true },
  { id: "marketing.benchmark-song", label: "Benchmark Song Campaign", parentId: "marketing", visibleByDefault: true },
  { id: "marketing.benchmark-general", label: "Benchmark General Campaign", parentId: "marketing", visibleByDefault: false },
  { id: "marketing.current-song", label: "Current Song Campaign", parentId: "marketing", visibleByDefault: true },
  { id: "marketing.current-general", label: "Current General Campaign", parentId: "marketing", visibleByDefault: false },
  { id: "marketing.next-song", label: "Next Song Campaign", parentId: "marketing", visibleByDefault: true },
  { id: "marketing.next-general", label: "Next General Campaign", parentId: "marketing", visibleByDefault: false },
  { id: "production", label: "Production", visibleByDefault: true },
  { id: "production.benchmark", label: "Benchmark Production", parentId: "production", visibleByDefault: true },
  { id: "production.current-song", label: "Current Song", parentId: "production", visibleByDefault: true },
  { id: "production.next-song", label: "Next Song", parentId: "production", visibleByDefault: true },
  { id: "budget", label: "Budget", visibleByDefault: true },
  { id: "roadmap", label: "Roadmap", visibleByDefault: true },
  { id: "qr-codes", label: "QR Codes", visibleByDefault: true }
] as const;

export type DashboardCardId = (typeof dashboardCardRegistry)[number]["id"];
export type DashboardPreferenceInput = {
  cardOrder?: readonly string[] | null;
  visibleCards?: readonly string[] | null;
};
export type ResolvedDashboardPreferences = {
  cardOrder: DashboardCardId[];
  childOrderByParent: Partial<Record<DashboardCardId, DashboardCardId[]>>;
  isPersonalized: boolean;
  topLevelOrder: DashboardCardId[];
  visibleCards: DashboardCardId[];
};

const cardById = new Map<string, (typeof dashboardCardRegistry)[number]>(
  dashboardCardRegistry.map((card) => [card.id, card])
);
const canonicalTopLevelOrder = dashboardCardRegistry
  .filter((card) => !("parentId" in card))
  .map((card) => card.id);

export function isKnownDashboardCardId(value: string): value is DashboardCardId {
  return cardById.has(value);
}

export function normalizeDashboardCardIds(values: unknown): DashboardCardId[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const normalized: DashboardCardId[] = [];
  for (const value of values) {
    if (typeof value !== "string" || seen.has(value) || !isKnownDashboardCardId(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

export function resolveDashboardPreferences(
  preferences: DashboardPreferenceInput = {}
): ResolvedDashboardPreferences {
  const savedOrder = normalizeDashboardCardIds(preferences.cardOrder);
  const isPersonalized = savedOrder.length > 0;
  const topLevelOrder = resolveScope(canonicalTopLevelOrder, savedOrder);
  const childOrderByParent: Partial<Record<DashboardCardId, DashboardCardId[]>> = {};

  for (const parentId of canonicalTopLevelOrder) {
    const children = dashboardCardRegistry
      .filter((card) => "parentId" in card && card.parentId === parentId)
      .map((card) => card.id);
    if (children.length) childOrderByParent[parentId] = resolveScope(children, savedOrder);
  }

  const cardOrder = topLevelOrder.flatMap((parentId) => [
    parentId,
    ...(childOrderByParent[parentId] ?? [])
  ]);
  const savedVisible = new Set(normalizeDashboardCardIds(preferences.visibleCards));
  const savedOrderSet = new Set(savedOrder);
  const visibleCards = cardOrder.filter((cardId) => {
    if (!isPersonalized) return cardById.get(cardId)?.visibleByDefault ?? false;
    // Cards absent from the user's saved order were introduced after their last
    // customization, so they inherit their canonical visibility by default.
    return savedOrderSet.has(cardId)
      ? savedVisible.has(cardId)
      : cardById.get(cardId)?.visibleByDefault ?? false;
  });

  return { cardOrder, childOrderByParent, isPersonalized, topLevelOrder, visibleCards };
}

function resolveScope(
  canonicalIds: readonly DashboardCardId[],
  savedOrder: readonly DashboardCardId[]
): DashboardCardId[] {
  const allowed = new Set(canonicalIds);
  const savedInScope = savedOrder.filter((id) => allowed.has(id));
  // Preserve the user's relative ordering, then append cards introduced later
  // in canonical order. Filtering by scope keeps children inside their parent.
  return [...savedInScope, ...canonicalIds.filter((id) => !savedInScope.includes(id))];
}

export const pixabayVideoCategories = ["backgrounds", "fashion", "nature", "science", "education", "feelings", "health", "people", "religion", "places", "animals", "industry", "computer", "food", "sports", "transportation", "travel", "buildings", "business", "music"] as const;

export type StudioVideoOrientation = "vertical" | "horizontal" | "square";
export type PixabaySearchFilters = { category?: string; order?: string; orientation?: StudioVideoOrientation; page?: number; query: string; videoType?: string };
export type PixabayVideoResult = { creator: string; durationSeconds: number; height: number; id: string; pageUrl: string; previewUrl: string; previewVideoUrl: string; tags: string; width: number };

type PixabayRendition = { height?: unknown; thumbnail?: unknown; url?: unknown; width?: unknown };
type PixabayHit = { duration?: unknown; id?: unknown; pageURL?: unknown; tags?: unknown; user?: unknown; videos?: Record<string, PixabayRendition> };

export function validatePixabaySearchFilters(value: Record<string, string | null>): { error?: string; value?: Required<PixabaySearchFilters> } {
  const query = (value.query ?? "").trim().replace(/\s+/g, " ");
  const category = value.category ?? "";
  const videoType = value.videoType ?? "all";
  const order = value.order ?? "popular";
  const page = Number(value.page ?? "1");
  const orientation = value.orientation ?? "vertical";
  if (!query || query.length > 100) return { error: "Enter a search of up to 100 characters." };
  if (category && !pixabayVideoCategories.includes(category as (typeof pixabayVideoCategories)[number])) return { error: "Unsupported Pixabay category." };
  if (videoType !== "all" && videoType !== "film" && videoType !== "animation") return { error: "Unsupported video type." };
  if (order !== "popular" && order !== "latest") return { error: "Unsupported result order." };
  if (orientation !== "vertical" && orientation !== "horizontal" && orientation !== "square") return { error: "Unsupported video orientation." };
  if (!Number.isInteger(page) || page < 1 || page > 20) return { error: "Unsupported results page." };
  return { value: { category, order, orientation, page, query, videoType } };
}

export function normalizePixabayVideoSearch(payload: unknown, orientation: StudioVideoOrientation = "vertical"): PixabayVideoResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.hits)) return [];
  return payload.hits.flatMap((raw): PixabayVideoResult[] => {
    if (!isRecord(raw)) return [];
    const hit = raw as PixabayHit;
    const rendition = Object.values(hit.videos ?? {}).filter((candidate) => isMatchingRendition(candidate, orientation))
      .sort((first, second) => (second.height * second.width) - (first.height * first.width))[0];
    if (!rendition || typeof hit.id !== "number" || typeof hit.pageURL !== "string" || typeof hit.duration !== "number" || typeof hit.tags !== "string" || typeof hit.user !== "string") return [];
    return [{ creator: hit.user, durationSeconds: hit.duration, height: rendition.height, id: String(hit.id), pageUrl: hit.pageURL, previewUrl: rendition.thumbnail, previewVideoUrl: rendition.url, tags: hit.tags, width: rendition.width }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isMatchingRendition(value: PixabayRendition, orientation: StudioVideoOrientation): value is { height: number; thumbnail: string; url: string; width: number } {
  if (typeof value.url !== "string" || typeof value.thumbnail !== "string" || typeof value.width !== "number" || typeof value.height !== "number") return false;
  if (orientation === "vertical") return value.height > value.width;
  if (orientation === "horizontal") return value.width > value.height;
  return Math.abs(value.width - value.height) / Math.max(value.width, value.height) <= 0.08;
}

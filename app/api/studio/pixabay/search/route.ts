import { NextResponse, type NextRequest } from "next/server";
import { normalizePixabayVideoSearch, validatePixabaySearchFilters } from "@/lib/studio/pixabay";
import { requireWorkspaceAccess, WorkspaceAccessError } from "@/lib/server/workspace-owner";

const cache = new Map<string, { expiresAt: number; results: ReturnType<typeof normalizePixabayVideoSearch> }>();
const cacheLifetimeMs = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const parsed = validatePixabaySearchFilters({
      category: request.nextUrl.searchParams.get("category"),
      order: request.nextUrl.searchParams.get("order"),
      orientation: request.nextUrl.searchParams.get("orientation"),
      page: request.nextUrl.searchParams.get("page"),
      query: request.nextUrl.searchParams.get("query"),
      videoType: request.nextUrl.searchParams.get("videoType")
    });
    if (!parsed.value) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const cacheKey = `${workspaceId}:${JSON.stringify(parsed.value)}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ results: cached.results, source: "cache" });
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Pixabay search is not configured. Add PIXABAY_API_KEY to the server environment." }, { status: 503 });
    const url = new URL("https://pixabay.com/api/videos/");
    url.search = new URLSearchParams({ key: apiKey, q: parsed.value.query, video_type: parsed.value.videoType, order: parsed.value.order, page: String(parsed.value.page), per_page: "40", safesearch: "true", ...(parsed.value.category ? { category: parsed.value.category } : {}) }).toString();
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error(response.status === 429 ? "Pixabay search is temporarily rate-limited. Try again shortly." : "Pixabay search is unavailable right now.");
    const results = normalizePixabayVideoSearch(await response.json(), parsed.value.orientation);
    cache.set(cacheKey, { expiresAt: Date.now() + cacheLifetimeMs, results });
    return NextResponse.json({ results, source: "pixabay" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pixabay search failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

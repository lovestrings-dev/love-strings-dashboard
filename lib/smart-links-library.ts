export const smartLinkStatuses = ["all", "draft", "published", "disabled", "archived"] as const;
export type SmartLinkStatusFilter = (typeof smartLinkStatuses)[number];
export type SmartLinkSort = "updated" | "newest" | "title";

export type SmartLinkDestinationSummary = {
  is_enabled: boolean;
  platform_key: string;
  retired_at: string | null;
};

export type SmartLinkListItem = {
  artwork_url_override: string | null;
  artist_name_override: string | null;
  created_at: string;
  id: string;
  public_slug: string;
  source_artist_name: string | null;
  source_artwork_url: string | null;
  source_song_title: string | null;
  status: Exclude<SmartLinkStatusFilter, "all">;
  title_override: string | null;
  updated_at: string;
};

export const smartLinkPreviewFixtures: Array<SmartLinkListItem & { destinations: SmartLinkDestinationSummary[] }> = [
  { id: "preview-01", public_slug: "afterglow", status: "draft", source_song_title: "Afterglow", source_artist_name: "Love Strings", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-11-20T11:20:00.000Z", updated_at: "2026-11-21T09:40:00.000Z", destinations: [{ platform_key: "spotify", is_enabled: true, retired_at: null }, { platform_key: "apple_music", is_enabled: true, retired_at: null }] },
  { id: "preview-02", public_slug: "paper-moon", status: "published", source_song_title: "Paper Moon", source_artist_name: "Love Strings", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-11-16T12:00:00.000Z", updated_at: "2026-11-20T15:16:00.000Z", destinations: [{ platform_key: "spotify", is_enabled: true, retired_at: null }, { platform_key: "apple_music", is_enabled: true, retired_at: null }, { platform_key: "youtube_music", is_enabled: true, retired_at: null }, { platform_key: "amazon_music", is_enabled: true, retired_at: null }] },
  { id: "preview-03", public_slug: "midnight-drive", status: "disabled", source_song_title: "Midnight Drive", source_artist_name: "Dima Sounder", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-11-09T18:00:00.000Z", updated_at: "2026-11-18T14:20:00.000Z", destinations: [{ platform_key: "spotify", is_enabled: true, retired_at: null }, { platform_key: "deezer", is_enabled: true, retired_at: null }] },
  { id: "preview-04", public_slug: "we-were-young-once", status: "archived", source_song_title: "We Were Young Once (Live at the Old Town Hall)", source_artist_name: "Love Strings", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-10-20T10:00:00.000Z", updated_at: "2026-11-11T08:30:00.000Z", destinations: [{ platform_key: "youtube_music", is_enabled: true, retired_at: null }, { platform_key: "custom", is_enabled: true, retired_at: null }] },
  { id: "preview-05", public_slug: "blue-room-session", status: "published", source_song_title: "Blue Room Session", source_artist_name: "Yullia & Dima", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-10-30T13:20:00.000Z", updated_at: "2026-11-17T17:30:00.000Z", destinations: [{ platform_key: "spotify", is_enabled: true, retired_at: null }, { platform_key: "apple_music", is_enabled: true, retired_at: null }, { platform_key: "youtube_music", is_enabled: true, retired_at: null }, { platform_key: "amazon_music", is_enabled: true, retired_at: null }, { platform_key: "deezer", is_enabled: true, retired_at: null }, { platform_key: "custom", is_enabled: true, retired_at: null }] },
  { id: "preview-06", public_slug: "violet", status: "draft", source_song_title: "Violet", source_artist_name: "Yullia", title_override: null, artist_name_override: null, source_artwork_url: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=160&q=80", artwork_url_override: null, created_at: "2026-11-21T07:00:00.000Z", updated_at: "2026-11-21T08:10:00.000Z", destinations: [{ platform_key: "spotify", is_enabled: true, retired_at: null }] }
];

export function smartLinkTitle(link: SmartLinkListItem) {
  return link.title_override?.trim() || link.source_song_title?.trim() || "Untitled Smart Link";
}

export function smartLinkArtist(link: SmartLinkListItem) {
  return link.artist_name_override?.trim() || link.source_artist_name?.trim() || "Artist not set";
}

export function smartLinkArtwork(link: SmartLinkListItem) {
  return link.artwork_url_override?.trim() || link.source_artwork_url?.trim() || "";
}

export function filterAndSortSmartLinks(
  links: SmartLinkListItem[],
  query: string,
  status: SmartLinkStatusFilter,
  sort: SmartLinkSort
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return links
    .filter((link) => status === "all" || link.status === status)
    .filter((link) => {
      if (!normalizedQuery) return true;
      return [smartLinkTitle(link), smartLinkArtist(link), link.public_slug]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .toSorted((left, right) => {
      if (sort === "title") return smartLinkTitle(left).localeCompare(smartLinkTitle(right));
      const leftDate = Date.parse(sort === "newest" ? left.created_at : left.updated_at);
      const rightDate = Date.parse(sort === "newest" ? right.created_at : right.updated_at);
      return rightDate - leftDate;
    });
}

export function enabledDestinationPlatforms(destinations: SmartLinkDestinationSummary[] | undefined) {
  return (destinations ?? [])
    .filter((destination) => destination.is_enabled && !destination.retired_at)
    .map((destination) => destination.platform_key);
}

export function lifecycleLabel(status: SmartLinkListItem["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

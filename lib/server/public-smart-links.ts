import "server-only";

import { createServiceSupabaseClient } from "@/lib/server/workspace-owner";

type PublicDestination = { platformKey: string; buttonLabel: string; targetUrl: string; };
type PublicSocialLink = { label: string; url: string; };

export type PublicSmartLink = {
  title: string;
  artistName: string;
  artworkUrl: string | null;
  backgroundMode: "blurred-artwork" | "solid-color";
  backgroundColor: string | null;
  destinations: PublicDestination[];
  socialLinks: PublicSocialLink[];
};

/** Development-only visual fixture. It is never returned in production. */
export const localSmartLinkPreview: PublicSmartLink = {
  title: "Pesenka Mamontenka", artistName: "Love Strings",
  artworkUrl: "https://res.cloudinary.com/zg6yhttv/image/upload/v1792176408/workspaces/00000000-0000-0000-0000-000000000001/production/a99f7c1d-9f4b-4926-b48e-6418f265cca5.jpg",
  backgroundMode: "blurred-artwork", backgroundColor: null,
  destinations: [
    { platformKey: "spotify", buttonLabel: "Spotify", targetUrl: "https://open.spotify.com/track/5xPDq8dS9nuu3Z5TutudPj?si=02141a4ef218408c" },
    { platformKey: "apple_music", buttonLabel: "Apple Music", targetUrl: "https://music.apple.com/us/album/pesenka-mamontenka-single/6830342297" },
    { platformKey: "youtube_music", buttonLabel: "YouTube Music", targetUrl: "https://music.youtube.com/playlist?list=OLAK5uy_llb044ZVVfS1PX3ebkalSZWj_JfjUhoLo" },
    { platformKey: "amazon_music", buttonLabel: "Amazon Music", targetUrl: "https://amazon.de/music/player/albums/B0HQ8R47C2?marketplaceId=A1PA6795UKMFR9&musicTerritory=DE&ref=dm_sh_OB0qSpeuQZmvkAcgGlINhYo3X" },
    { platformKey: "deezer", buttonLabel: "Deezer", targetUrl: "https://link.deezer.com/s/350Ph3cFynn0tWwRwv7xH" },
    { platformKey: "custom", buttonLabel: "YouTube Channel", targetUrl: "https://www.youtube.com/channel/UCKlfg9lYKyMOg_Oiz-Zb1Fg" }
  ],
  socialLinks: [{ label: "Instagram", url: "https://www.instagram.com/lovestringsband/" }, { label: "YouTube", url: "https://www.youtube.com/@LoveStringsBand" }]
};

const validBackgroundColor = /^#[0-9a-fA-F]{6}$/;

/** Query only the published state and map just fields required for the public page. */
export async function resolvePublishedSmartLink(slug: string): Promise<PublicSmartLink | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const client = createServiceSupabaseClient();
    const { data: link, error } = await client.from("smart_links")
      .select("id, status, source_song_title, source_artist_name, source_artwork_url, title_override, artist_name_override, artwork_url_override, background_mode, background_color, social_links")
      .eq("public_slug", slug).eq("status", "published").maybeSingle();
    if (error || !link) return null;
    const title = firstNonEmpty(link.title_override, link.source_song_title);
    const artistName = firstNonEmpty(link.artist_name_override, link.source_artist_name);
    if (!title || !artistName) return null;
    const { data: rows, error: destinationError } = await client.from("smart_link_destinations")
      .select("platform_key, button_label, target_url, position, retired_at")
      .eq("smart_link_id", link.id).eq("is_enabled", true).is("retired_at", null).order("position", { ascending: true });
    if (destinationError) return null;
    const destinations = (rows ?? []).flatMap((row) => {
      const targetUrl = safeHttpsUrl(row.target_url);
      const buttonLabel = normalizeText(row.button_label, 80);
      return targetUrl && buttonLabel && isSupportedDestinationPlatform(row.platform_key) ? [{ platformKey: row.platform_key, buttonLabel, targetUrl }] : [];
    });
    if (!destinations.length) return null;
    return {
      title, artistName, artworkUrl: safeHttpsUrl(firstNonEmpty(link.artwork_url_override, link.source_artwork_url)),
      backgroundMode: link.background_mode === "solid-color" ? "solid-color" : "blurred-artwork",
      backgroundColor: typeof link.background_color === "string" && validBackgroundColor.test(link.background_color) ? link.background_color : null,
      destinations, socialLinks: normalizeSocialLinks(link.social_links)
    };
  } catch { return null; }
}

function firstNonEmpty(...values: unknown[]) { for (const value of values) { const normalized = normalizeText(value, 200); if (normalized) return normalized; } return ""; }
function normalizeText(value: unknown, maxLength: number) { return typeof value === "string" ? value.trim().slice(0, maxLength) : ""; }
function safeHttpsUrl(value: unknown) { if (typeof value !== "string" || value.length > 2000) return null; try { const parsed = new URL(value); return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password ? parsed.toString() : null; } catch { return null; } }
function isSupportedDestinationPlatform(value: unknown): value is PublicDestination["platformKey"] { return typeof value === "string" && ["spotify", "apple_music", "youtube_music", "amazon_music", "deezer", "custom"].includes(value); }
function normalizeSocialLinks(value: unknown): PublicSocialLink[] { if (!Array.isArray(value)) return []; return value.flatMap((entry) => { if (!entry || typeof entry !== "object") return []; const record = entry as Record<string, unknown>; if (record.isEnabled !== true) return []; const label = normalizeText(record.label, 80); const url = safeHttpsUrl(record.url); return label && url ? [{ label, url }] : []; }); }

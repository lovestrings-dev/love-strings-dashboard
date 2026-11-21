/* eslint-disable @next/next/no-img-element -- published artwork is workspace-configured. */
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Link2, Music2 } from "lucide-react";
import { localSmartLinkPreview, resolvePublishedSmartLink } from "@/lib/server/public-smart-links";
import { isReservedSmartLinkSlug } from "@/lib/smart-link-public-routing";

type PageProps = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  noStore(); const { slug } = await params; const link = await resolvePublicLink(slug);
  if (!link) return {};
  return { title: `${link.title} — ${link.artistName}`, description: `Listen to ${link.title} by ${link.artistName}.`, openGraph: { title: `${link.title} — ${link.artistName}`, description: `Listen to ${link.title} by ${link.artistName}.`, images: link.artworkUrl ? [{ url: link.artworkUrl }] : [] } };
}

export default async function PublicSmartLinkPage({ params }: PageProps) {
  noStore(); const { slug } = await params; const link = await resolvePublicLink(slug); if (!link) notFound();
  const style: CSSProperties | undefined = link.backgroundMode === "solid-color" ? { "--public-smart-link-background": link.backgroundColor ?? "#141a1c" } as CSSProperties : undefined;
  return <main className={`public-smart-link ${link.backgroundMode === "blurred-artwork" ? "has-artwork-background" : ""}`} style={style}>
    {link.backgroundMode === "blurred-artwork" && link.artworkUrl ? <img className="public-smart-link-backdrop" src={link.artworkUrl} alt="" aria-hidden="true" /> : null}
    <div className="public-smart-link-shade" />
    <section className="public-smart-link-card" aria-label={`${link.title} by ${link.artistName}`}>
      <div className="public-smart-link-brand"><img src="/artistdeck-logo.png" alt="" /><span>ArtistDeck</span></div>
      {link.artworkUrl ? <img className="public-smart-link-artwork" src={link.artworkUrl} alt={`Cover artwork for ${link.title}`} /> : <div className="public-smart-link-artwork public-smart-link-artwork-fallback"><Music2 size={42} aria-hidden="true" /></div>}
      <h1>{link.title}</h1><p className="public-smart-link-artist">{link.artistName}</p>
      <nav className="public-smart-link-destinations" aria-label="Listen on">{link.destinations.map((destination) => <a key={`${destination.platformKey}-${destination.targetUrl}`} href={destination.targetUrl} target="_blank" rel="noopener noreferrer"><span><PlatformMark label={destination.buttonLabel} platform={destination.platformKey} />{destination.buttonLabel}</span><b>{destination.platformKey === "custom" ? "Open" : "Play"}</b></a>)}</nav>
      {link.socialLinks.length ? <nav className="public-smart-link-socials" aria-label="Social links">{link.socialLinks.map((social) => <a key={social.url} href={social.url} target="_blank" rel="noopener noreferrer">{social.label}</a>)}</nav> : null}
      <small className="public-smart-link-footer">Terms&nbsp; · &nbsp;Privacy<br />Powered by ArtistDeck.app</small>
    </section>
  </main>;
}

function PlatformMark({ label, platform }: { label: string; platform: string }) {
  const logos: Record<string, string> = { spotify: "https://cdn.simpleicons.org/spotify/1ED760", apple_music: "https://cdn.simpleicons.org/applemusic/FA243C", youtube_music: "https://cdn.simpleicons.org/youtubemusic/FF0000", amazon_music: "/smart-links/amazon-music.png", deezer: "https://cdn.simpleicons.org/deezer/A238FF" };
  const source = platform === "custom" && /youtube/i.test(label) ? "https://cdn.simpleicons.org/youtube/FF0000" : logos[platform];
  return source ? <img src={source} alt="" /> : <Link2 size={15} aria-hidden="true" />;
}

async function resolvePublicLink(slug: string) {
  if (process.env.NODE_ENV === "development" && ["artist-pilot", "pesenka-mamontenka"].includes(slug)) return localSmartLinkPreview;
  if (isReservedSmartLinkSlug(slug)) return null;
  return resolvePublishedSmartLink(slug);
}

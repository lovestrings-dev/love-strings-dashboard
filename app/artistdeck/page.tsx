/* eslint-disable @next/next/no-img-element -- static ArtistDeck logo. */
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, Megaphone } from "lucide-react";

export const metadata: Metadata = {
  title: "ArtistDeck — A clearer release workflow",
  description: "ArtistDeck helps independent artists organise releases, track performance, and promote music."
};

const pillars = [
  { icon: CalendarDays, title: "Organise the work", text: "Keep songs, release steps, content plans, and deadlines in one calm workspace." },
  { icon: BarChart3, title: "See the performance", text: "Bring key platform signals together so progress is visible without living in spreadsheets." },
  { icon: Megaphone, title: "Share the release", text: "Build a focused Smart Link that gives listeners one clear place to find your music." }
];

export default function ArtistDeckPage() {
  return <main className="artistdeck-about-page">
    <section className="artistdeck-about-hero">
      <div className="artistdeck-about-brand"><img src="/artistdeck-logo.png" alt="" />ArtistDeck</div>
      <p className="artistdeck-about-eyebrow">For independent artists</p>
      <h1>Make room for the music.</h1>
      <p className="artistdeck-about-intro">ArtistDeck is a release workspace for artists and teams who want a clearer way to organise the work, understand what is moving, and share each release with confidence.</p>
      <div className="artistdeck-about-pillars">{pillars.map(({ icon: Icon, text, title }) => <article key={title}><span><Icon aria-hidden size={22} /></span><h2>{title}</h2><p>{text}</p></article>)}</div>
      <p className="artistdeck-about-placeholder">ArtistDeck is currently evolving. This is a short introduction page while the full public website is in development.</p>
      <Link className="artistdeck-about-terms" href="/terms">Terms of Use</Link>
    </section>
  </main>;
}

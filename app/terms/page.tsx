/* eslint-disable @next/next/no-img-element -- static ArtistDeck logo. */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — ArtistDeck",
  description: "Terms of use for ArtistDeck and ArtistDeck Smart Links."
};

export default function TermsPage() {
  return <main className="public-legal-page">
    <article className="public-legal-card">
      <Link className="public-legal-brand" href="/artistdeck"><img src="/artistdeck-logo.png" alt="" />ArtistDeck</Link>
      <p className="public-legal-eyebrow">Legal</p>
      <h1>Terms of Use</h1>
      <p className="public-legal-updated">Last updated: 22 November 2026</p>
      <p>ArtistDeck helps independent artists and their teams create and share music-release pages. By using ArtistDeck or an ArtistDeck Smart Link, you agree to these Terms.</p>

      <section>
        <h2>What ArtistDeck provides</h2>
        <p>ArtistDeck provides tools for creating landing pages and directing visitors to music, social, and other destinations chosen by the relevant workspace owner. ArtistDeck is a technical platform, not the publisher, distributor, promoter, or owner of the music and content shown on each Smart Link.</p>
      </section>

      <section>
        <h2>Workspace-owner content</h2>
        <p>The workspace owner is responsible for the accuracy, legality, permissions, and rights connected with their artwork, music, links, copy, tracking settings, and any other content they add. They must have the rights needed to use and share that material.</p>
      </section>

      <section>
        <h2>Third-party services and links</h2>
        <p>Smart Links may lead to third-party services such as music platforms, social networks, or shops. Those services operate under their own terms and privacy practices. ArtistDeck does not control, endorse, or guarantee their content, availability, purchases, subscriptions, tracking, or policies.</p>
      </section>

      <section>
        <h2>Availability and sensible limits</h2>
        <p>ArtistDeck is provided on an “as available” basis. We work to keep it useful and reliable, but we cannot promise that every page, destination, or integration will always be uninterrupted, error-free, secure, or available in every place and at every time.</p>
        <p>To the fullest extent permitted by applicable law, ArtistDeck is not liable for indirect, incidental, special, consequential, or lost-profit damages arising from use of the service, a Smart Link, or a third-party destination. Nothing in these Terms limits rights or liabilities that cannot lawfully be excluded or limited.</p>
      </section>

      <section>
        <h2>Changes and questions</h2>
        <p>ArtistDeck may improve, change, pause, or discontinue features when reasonably necessary. We may update these Terms as the service develops; the date above shows when they were last updated. Continued use after an update means you accept the updated Terms, where permitted by law.</p>
      </section>

      <section>
        <h2>Your statutory rights</h2>
        <p>These Terms are intended to be clear and fair. They do not remove consumer protections or other mandatory rights that apply to you under the law.</p>
      </section>
    </article>
  </main>;
}

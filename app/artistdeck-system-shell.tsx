import Image from "next/image";
import type { ReactNode } from "react";

export function ArtistDeckSystemShell({ children, description, heading }: { children?: ReactNode; description?: ReactNode; heading?: string }) {
  return (
    <main className="artistdeck-system-page">
      <section className="artistdeck-system-card" aria-labelledby={heading ? "artistdeck-system-title" : undefined}>
        <Image alt="ArtistDeck" className="artistdeck-system-logo" height={72} priority src="/artistdeck-logo.png" width={72} />
        <div><p className="eyebrow">ArtistDeck</p>{heading ? <h1 id="artistdeck-system-title">{heading}</h1> : null}</div>
        {description ? <p className="artistdeck-system-description">{description}</p> : null}
        {children}
      </section>
    </main>
  );
}

export function ArtistDeckLoading() {
  return <div aria-busy="true" className="dashboard-initial-loading" role="status"><div aria-hidden className="dashboard-initial-loading-center"><span className="dashboard-initial-loading-spinner" /></div><span className="sr-only">Loading</span></div>;
}

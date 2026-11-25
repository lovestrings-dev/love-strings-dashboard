"use client";
/* eslint-disable @next/next/no-img-element -- artwork hosts are user-configured external URLs. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, ChevronDown, Copy, FilePlus2, Info, Link2, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import {
  enabledDestinationPlatforms,
  filterAndSortSmartLinks,
  lifecycleLabel,
  smartLinkArtist,
  smartLinkArtwork,
  smartLinkPreviewFixtures,
  smartLinkStatuses,
  smartLinkTitle,
  type SmartLinkDestinationSummary,
  type SmartLinkListItem,
  type SmartLinkSort,
  type SmartLinkStatusFilter
} from "@/lib/smart-links-library";

type SmartLinkRow = SmartLinkListItem & {
  destinations?: SmartLinkDestinationSummary[];
  statistics?: { clicks: number; ctr: number; views: number };
};
type SmartLinksResponse = { canManage?: boolean; error?: string; links?: SmartLinkRow[]; workspaceId?: string };

const platformLabels: Record<string, string> = {
  amazon_music: "Amazon Music", apple_music: "Apple Music", custom: "Custom", deezer: "Deezer", spotify: "Spotify", youtube_music: "YouTube Music"
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatStatistic(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function SmartLinksLibrary() {
  const [links, setLinks] = useState<SmartLinkRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SmartLinkStatusFilter>("all");
  const [sort, setSort] = useState<SmartLinkSort>("updated");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const fixtureMode = process.env.NODE_ENV === "development" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("smartLinksPreview") === "fixtures";

  const loadLinks = useCallback(async () => {
    setLoadState("loading");
    setError("");
    try {
      const response = await fetch("/api/smart-links", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as SmartLinksResponse | null;
      if (!response.ok || !payload?.links) throw new Error(payload?.error ?? "Smart Links could not be loaded.");
      setLinks(payload.links);
      setCanManage(payload.canManage === true);
      setLoadState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Smart Links could not be loaded.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (fixtureMode) {
      const previewId = window.setTimeout(() => setLoadState("ready"), 0);
      return () => window.clearTimeout(previewId);
    }
    const requestId = window.setTimeout(() => { void loadLinks(); }, 0);
    return () => window.clearTimeout(requestId);
  }, [fixtureMode, loadLinks]);

  const displayLinks = fixtureMode ? smartLinkPreviewFixtures : links;
  const visibleLinks = useMemo(() => filterAndSortSmartLinks(displayLinks, query, status, sort), [displayLinks, query, sort, status]);

  async function copyLink(slug: string) {
    const value = `https://artistdeck.app/${slug}`;
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Smart Link URL copied.");
    } catch {
      setNotice("Could not copy the URL. Please copy it manually.");
    }
  }

  async function transition(link: SmartLinkRow, nextStatus: "published" | "disabled" | "archived" | "draft") {
    const intent = nextStatus === "published" ? "publish" : nextStatus;
    if (!window.confirm(`Are you sure you want to ${intent} “${smartLinkTitle(link)}”?`)) return;
    setBusyId(link.id);
    setOpenMenuId(null);
    setNotice("");
    try {
      const response = await fetch(
        nextStatus === "published" ? `/api/smart-links/${link.id}/publish` : `/api/smart-links/${link.id}/lifecycle`,
        {
          body: JSON.stringify(nextStatus === "published" ? { expectedUpdatedAt: link.updated_at } : { expectedUpdatedAt: link.updated_at, status: nextStatus }),
          headers: { "content-type": "application/json" },
          method: nextStatus === "published" ? "POST" : "PATCH"
        }
      );
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Smart Link lifecycle update failed.");
      setNotice(`Smart Link ${nextStatus === "published" ? "published" : `${nextStatus}`}.`);
      await loadLinks();
    } catch (mutationError) {
      setNotice(mutationError instanceof Error ? mutationError.message : "Smart Link lifecycle update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(link: SmartLinkRow) {
    const suggestedSlug = `${link.public_slug}-copy`.slice(0, 80);
    const slug = window.prompt("New draft slug", suggestedSlug)?.trim();
    if (!slug) return;
    setBusyId(link.id);
    setOpenMenuId(null);
    setNotice("");
    try {
      const response = await fetch(`/api/smart-links/${link.id}/duplicate`, {
        body: JSON.stringify({ expectedUpdatedAt: link.updated_at, slug }),
        headers: { "content-type": "application/json" }, method: "POST"
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Smart Link duplication failed.");
      setNotice("Draft duplicate created.");
      await loadLinks();
    } catch (mutationError) {
      setNotice(mutationError instanceof Error ? mutationError.message : "Smart Link duplication failed.");
    } finally {
      setBusyId(null);
    }
  }

  return <section className="smart-links-library" aria-labelledby="smart-links-heading">
    <header className="smart-links-heading">
      <div><p className="eyebrow">Workspace · Distribution</p><h1 id="smart-links-heading">Smart Links</h1><p>Create and manage landing pages for your music.</p></div>
      {canManage || fixtureMode ? <Link className="smart-links-primary-action" href="/smart-links/new"><Plus aria-hidden size={17} />New Smart Link</Link> : <span className="smart-links-read-only">Viewer access · read-only</span>}
    </header>
    {fixtureMode ? <div className="smart-links-fixture-banner" role="status"><Info aria-hidden size={16} /><span><strong>Local preview data</strong> Six illustrative Smart Links only. Nothing here is stored in your workspace.</span></div> : null}
    {notice ? <p className="smart-links-notice" role="status">{notice}</p> : null}
    <div className="smart-links-toolbar" aria-label="Smart Link filters">
      <label className="smart-links-search"><Search aria-hidden size={17} /><input aria-label="Search Smart Links" onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, artist or URL…" type="search" value={query} /></label>
      <label><span>Status</span><select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value as SmartLinkStatusFilter)} value={status}>{smartLinkStatuses.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : lifecycleLabel(option)}</option>)}</select></label>
      <label><span>Sort</span><select aria-label="Sort Smart Links" onChange={(event) => setSort(event.target.value as SmartLinkSort)} value={sort}><option value="updated">Recently updated</option><option value="newest">Newest</option><option value="title">Title</option></select></label>
    </div>
    {loadState === "loading" ? <SmartLinksLoading /> : null}
    {loadState === "error" ? <div className="smart-links-state is-error" role="alert"><Link2 aria-hidden size={22} /><div><strong>Smart Links couldn’t load</strong><p>{error}</p></div><button onClick={() => void loadLinks()} type="button">Try again</button></div> : null}
    {loadState === "ready" && displayLinks.length === 0 ? <SmartLinksEmpty canManage={canManage} /> : null}
    {loadState === "ready" && displayLinks.length > 0 && visibleLinks.length === 0 ? <div className="smart-links-state"><Search aria-hidden size={22} /><div><strong>No matching Smart Links</strong><p>Try another search or status filter.</p></div><button onClick={() => { setQuery(""); setStatus("all"); }} type="button">Clear filters</button></div> : null}
    {loadState === "ready" && visibleLinks.length > 0 ? <div className="smart-links-table-wrap"><table className="smart-links-table"><thead><tr><th>Smart Link</th><th>Link</th><th>Status</th><th>Destinations</th><th>Updated</th><th><span className="smart-links-stats-heading" title="Anonymous aggregate landing-page views, destination clicks, and click-through rate.">Statistics <Info aria-hidden size={13} /></span></th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleLinks.map((link) => <SmartLinksRow busy={busyId === link.id} canManage={canManage || fixtureMode} fixtureMode={fixtureMode} key={link.id} link={link} onCopy={copyLink} onDuplicate={duplicate} onMenuChange={setOpenMenuId} onTransition={transition} openMenu={openMenuId === link.id} />)}</tbody></table></div> : null}
  </section>;
}

function SmartLinksLoading() { return <div className="smart-links-loading" aria-busy="true" role="status"><span /><span /><span /><span /><span /></div>; }

function SmartLinksEmpty({ canManage }: { canManage: boolean }) { return <div className="smart-links-empty"><FilePlus2 aria-hidden size={28} /><h2>No Smart Links yet</h2><p>Create a shareable release landing page when you’re ready. New links stay in Draft until you choose to publish them.</p>{canManage ? <Link className="smart-links-primary-action" href="/smart-links/new"><Plus aria-hidden size={17} />New Smart Link</Link> : null}</div>; }

function SmartLinksRow({ busy, canManage, fixtureMode, link, onCopy, onDuplicate, onMenuChange, onTransition, openMenu }: { busy: boolean; canManage: boolean; fixtureMode: boolean; link: SmartLinkRow; onCopy: (slug: string) => void; onDuplicate: (link: SmartLinkRow) => void; onMenuChange: (id: string | null) => void; onTransition: (link: SmartLinkRow, status: "published" | "disabled" | "archived" | "draft") => void; openMenu: boolean }) {
  const artwork = smartLinkArtwork(link);
  const platforms = enabledDestinationPlatforms(link.destinations);
  const lifecycleAction = link.status === "draft" ? "published" : link.status === "published" ? "disabled" : link.status === "disabled" ? "published" : "draft";
  const lifecycleLabelText = link.status === "draft" ? "Publish" : link.status === "published" ? "Disable" : link.status === "disabled" ? "Re-publish" : "Restore draft";
  return <tr className="smart-links-row">
    <td data-label="Smart Link"><div className="smart-links-song"><span className="smart-links-artwork">{artwork ? <img alt="" src={artwork} /> : <Link2 aria-hidden size={19} />}</span><span><strong>{smartLinkTitle(link)}</strong><small>{smartLinkArtist(link)}</small></span></div></td>
    <td data-label="Link"><div className="smart-links-url"><span>artistdeck.app/{link.public_slug}</span><button aria-label={`Copy artistdeck.app/${link.public_slug}`} onClick={() => void onCopy(link.public_slug)} title="Copy URL" type="button"><Copy aria-hidden size={15} /></button></div></td>
    <td data-label="Status"><span className={`smart-links-status is-${link.status}`}>{lifecycleLabel(link.status)}</span></td>
    <td data-label="Destinations"><div className="smart-links-destinations">{platforms.length ? platforms.map((platform) => <span key={platform}>{platformLabels[platform] ?? platform}</span>) : <span className="is-none">None configured</span>}</div></td>
    <td data-label="Updated"><time dateTime={link.updated_at}>{displayDate(link.updated_at)}</time></td>
    <td className="smart-links-stats" data-label="Statistics"><span>{formatStatistic(link.statistics?.views ?? 0)}<small>Views</small></span><span>{formatStatistic(link.statistics?.clicks ?? 0)}<small>Clicks</small></span><span>{(link.statistics?.ctr ?? 0).toFixed(1)}%<small>CTR</small></span></td>
    <td className="smart-links-actions" data-label="Actions">{canManage ? <>{fixtureMode ? <button aria-label={`Edit ${smartLinkTitle(link)}`} className="smart-links-icon-button" disabled title="Sample data" type="button"><Pencil aria-hidden size={16} /></button> : <Link aria-label={`Edit ${smartLinkTitle(link)}`} className="smart-links-icon-button" href={`/smart-links/${link.id}`} title="Edit"><Pencil aria-hidden size={16} /></Link>}<div className="smart-links-menu-wrap"><button aria-expanded={openMenu} aria-haspopup="menu" aria-label={`More actions for ${smartLinkTitle(link)}`} className="smart-links-icon-button" disabled={busy} onClick={() => onMenuChange(openMenu ? null : link.id)} type="button"><MoreHorizontal aria-hidden size={18} /></button>{openMenu ? <div className="smart-links-menu" role="menu">{fixtureMode ? <p>Sample actions are disabled</p> : <><button onClick={() => onDuplicate(link)} role="menuitem" type="button"><Copy aria-hidden size={15} />Duplicate</button><button onClick={() => onTransition(link, lifecycleAction)} role="menuitem" type="button">{link.status === "draft" || link.status === "disabled" ? <Check aria-hidden size={15} /> : <ChevronDown aria-hidden size={15} />}{lifecycleLabelText}</button>{link.status !== "archived" ? <button onClick={() => onTransition(link, "archived")} role="menuitem" type="button"><Archive aria-hidden size={15} />Archive</button> : null}</>}</div> : null}</div></> : <span className="smart-links-view-only">View only</span>}</td>
  </tr>;
}

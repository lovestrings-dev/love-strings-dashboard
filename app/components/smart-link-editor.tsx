"use client";
/* eslint-disable @next/next/no-img-element -- artwork URLs are workspace-configured. */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Eye, GripVertical, ImagePlus, Info, Link2, LoaderCircle, Lock, Music2, Plus, Radio, RotateCcw, Save, Search } from "lucide-react";

type Status = "draft" | "published" | "disabled" | "archived";
type Platform = "spotify" | "apple_music" | "youtube_music" | "amazon_music" | "deezer" | "custom";
type Destination = { id?: string; platform_key: Platform; button_label: string; target_url: string; source_kind: "manual" | "catalog"; source_metadata: Record<string, unknown>; position: number; is_enabled: boolean; retired_at?: string | null };
type LinkRecord = { id: string; production_song_id: string | null; public_slug: string; status: Status; source_song_title: string; source_artist_name: string; source_artwork_url: string | null; title_override: string | null; artist_name_override: string | null; artwork_url_override: string | null; background_mode: "blurred-artwork" | "solid-color"; background_color: string | null; pixel_mode: "inherit" | "override" | "disabled"; pixel_override_id: string | null; updated_at: string; published_at: string | null };
type Document = { link: LinkRecord; destinations: Destination[] };
type Song = { id: string; title: string; album_art_url: string | null };

const platforms: { key: Platform; label: string; mark: string }[] = [
  { key: "spotify", label: "Spotify", mark: "●" }, { key: "apple_music", label: "Apple Music", mark: "♪" },
  { key: "youtube_music", label: "YouTube Music", mark: "▶" }, { key: "amazon_music", label: "Amazon Music", mark: "a" },
  { key: "deezer", label: "Deezer", mark: "≋" }, { key: "custom", label: "Custom", mark: "↗" }
];
const platformByKey = Object.fromEntries(platforms.map((platform) => [platform.key, platform]));
const platformLogoUrls: Partial<Record<Platform, string>> = {
  spotify: "https://cdn.simpleicons.org/spotify/1ED760",
  apple_music: "https://cdn.simpleicons.org/applemusic/FA243C",
  youtube_music: "https://cdn.simpleicons.org/youtubemusic/FF0000",
  amazon_music: "/smart-links/amazon-music.png",
  deezer: "https://cdn.simpleicons.org/deezer/A238FF"
};

function emptyDestination(platform: Platform, position: number): Destination {
  return { platform_key: platform, button_label: platformByKey[platform].label, target_url: "", source_kind: "manual", source_metadata: {}, position, is_enabled: true };
}

function newDocument(): Document {
  return { link: { id: "", production_song_id: null, public_slug: "", status: "draft", source_song_title: "", source_artist_name: "", source_artwork_url: null, title_override: "", artist_name_override: "", artwork_url_override: "", background_mode: "blurred-artwork", background_color: null, pixel_mode: "inherit", pixel_override_id: "", updated_at: "", published_at: null }, destinations: [emptyDestination("spotify", 0)] };
}

function effectiveTitle(link: LinkRecord) { return link.title_override || link.source_song_title || "Untitled release"; }
function effectiveArtist(link: LinkRecord) { return link.artist_name_override || link.source_artist_name || "Artist name"; }
function effectiveArtwork(link: LinkRecord) { return link.artwork_url_override || link.source_artwork_url; }
function displayStatus(status: Status) { return status[0].toUpperCase() + status.slice(1); }
function toSlug(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }

export function SmartLinkEditor({ initialMode, initialSongId, mode }: { initialMode?: "linked" | "standalone"; initialSongId?: string; mode: "new" | "edit" }) {
  const params = useParams<{ smartLinkId: string }>();
  const router = useRouter();
  const linkId = mode === "edit" ? params.smartLinkId : null;
  const [document, setDocument] = useState<Document>(newDocument);
  const [songs, setSongs] = useState<Song[]>([]);
  const [workspaceArtist, setWorkspaceArtist] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [songPickerOpen, setSongPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setState("loading"); setError("");
    try {
      const requests = [fetch("/api/smart-links/production-songs", { cache: "no-store" })];
      if (linkId) requests.push(fetch(`/api/smart-links/${linkId}`, { cache: "no-store" }));
      const responses = await Promise.all(requests);
      const songPayload = await responses[0].json().catch(() => null) as { songs?: Song[]; canManage?: boolean; error?: string; workspaceName?: string } | null;
      if (!responses[0].ok || !songPayload?.songs) throw new Error(songPayload?.error ?? "Source songs could not be loaded.");
      setSongs(songPayload.songs); setWorkspaceArtist(songPayload.workspaceName ?? ""); setCanManage(songPayload.canManage === true);
      if (linkId) {
        const payload = await responses[1].json().catch(() => null) as { smartLink?: Document; canManage?: boolean; error?: string } | null;
        if (!responses[1].ok || !payload?.smartLink) throw new Error(payload?.error ?? "Smart Link could not be loaded.");
        setDocument({ link: payload.smartLink.link, destinations: payload.smartLink.destinations.filter((item) => !item.retired_at).sort((a, b) => a.position - b.position) });
        setCanManage(payload.canManage === true);
      } else if (initialMode === "linked" && initialSongId) {
        const song = songPayload.songs.find((item) => item.id === initialSongId);
        if (!song) throw new Error("That Production song is unavailable in this workspace.");
        const draft = newDocument();
        draft.link.production_song_id = song.id;
        draft.link.source_song_title = song.title;
        draft.link.source_artist_name = songPayload.workspaceName ?? "";
        draft.link.source_artwork_url = song.album_art_url;
        draft.link.public_slug = toSlug(song.title);
        setDocument(draft);
      }
      setDirty(false); setState("ready");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "The editor could not be loaded."); setState("error"); }
  }, [initialMode, initialSongId, linkId]);

  useEffect(() => {
    const requestId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(requestId);
  }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (current: Document) => Document) => { setDocument((current) => fn(current)); setDirty(true); setNotice(""); };
  const updateLink = (patch: Partial<LinkRecord>) => update((current) => ({ ...current, link: { ...current.link, ...patch } }));
  const selectedSong = songs.find((song) => song.id === document.link.production_song_id);
  const lockedSlug = Boolean(document.link.published_at);
  const activeDestinations = document.destinations.filter((destination) => destination.is_enabled).sort((a, b) => a.position - b.position);

  const validation = useMemo(() => {
    if (!effectiveTitle(document.link).trim() || !effectiveArtist(document.link).trim()) return "Add a title and artist before saving.";
    if (!document.link.public_slug.trim()) return "Add a Smart Link slug before saving.";
    if (!document.destinations.length) return "Add at least one destination before saving.";
    if (document.destinations.some((destination) => !destination.target_url.trim())) return "Add a URL for each destination before saving.";
    return "";
  }, [document]);

  function updateTitle(value: string) { update((current) => ({ ...current, link: { ...current.link, title_override: value, public_slug: current.link.public_slug || toSlug(value) } })); }
  function selectSong(song: Song | null) {
    update((current) => ({ ...current, link: {
      ...current.link, production_song_id: song?.id ?? null, source_song_title: song?.title ?? "", source_artist_name: song ? workspaceArtist : "", source_artwork_url: song?.album_art_url ?? null,
      title_override: "", artist_name_override: "", artwork_url_override: "", public_slug: song ? toSlug(song.title) : current.link.public_slug
    } }));
    setSongQuery("");
  }
  function updateDestination(index: number, patch: Partial<Destination>) { update((current) => ({ ...current, destinations: current.destinations.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })); }
  function moveDestination(index: number, delta: number) { const next = index + delta; if (next < 0 || next >= document.destinations.length) return; update((current) => { const destinations = [...current.destinations]; [destinations[index], destinations[next]] = [destinations[next], destinations[index]]; return { ...current, destinations: destinations.map((item, position) => ({ ...item, position })) }; }); }
  function addDestination(platform: Platform) { if (document.destinations.some((item) => item.platform_key === platform) || document.destinations.length >= 6) return; update((current) => ({ ...current, destinations: [...current.destinations, emptyDestination(platform, current.destinations.length)] })); }

  function payload() {
    return { slug: document.link.public_slug, productionSongId: document.link.production_song_id ?? "", titleOverride: document.link.title_override ?? "", artistNameOverride: document.link.artist_name_override ?? "", artworkUrlOverride: document.link.artwork_url_override ?? "", backgroundMode: document.link.background_mode, backgroundColor: document.link.background_color ?? "", socialLinks: [], pixelMode: document.link.pixel_mode, pixelOverrideId: document.link.pixel_override_id ?? "", destinations: document.destinations.map((item, position) => ({ id: item.id, platformKey: item.platform_key, buttonLabel: item.button_label, targetUrl: item.target_url, sourceKind: item.source_kind, sourceMetadata: item.source_metadata, position, isEnabled: item.is_enabled, retire: false })) };
  }
  async function save() {
    if (!canManage) return; if (validation) { setError(validation); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(linkId ? `/api/smart-links/${linkId}` : "/api/smart-links", { method: linkId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(linkId ? { expectedUpdatedAt: document.link.updated_at, updates: payload() } : payload()) });
      const result = await response.json().catch(() => null) as { smartLink?: Document; error?: string } | null;
      if (!response.ok || !result?.smartLink) throw new Error(result?.error ?? "Smart Link could not be saved.");
      setDocument(result.smartLink); setDirty(false); setNotice("Draft saved.");
      if (!linkId) router.replace(`/smart-links/${result.smartLink.link.id}`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Smart Link could not be saved."); } finally { setSaving(false); }
  }
  async function transition(next: Status) {
    if (!linkId || !canManage) return;
    const action = next === "published" ? "publish" : next === "draft" ? "restore this draft" : next;
    if (!window.confirm(`Are you sure you want to ${action}? Public landing pages arrive in Phase 3.`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(next === "published" ? `/api/smart-links/${linkId}/publish` : `/api/smart-links/${linkId}/lifecycle`, { method: next === "published" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next === "published" ? { expectedUpdatedAt: document.link.updated_at } : { expectedUpdatedAt: document.link.updated_at, status: next }) });
      const result = await response.json().catch(() => null) as { smartLink?: Document; error?: string } | null;
      if (!response.ok || !result?.smartLink) throw new Error(result?.error ?? "Lifecycle update failed.");
      setDocument(result.smartLink); setDirty(false); setNotice(`Smart Link ${next === "published" ? "published" : "updated"}. Public pages arrive in Phase 3.`);
    } catch (transitionError) { setError(transitionError instanceof Error ? transitionError.message : "Lifecycle update failed."); } finally { setSaving(false); }
  }
  async function duplicate() {
    if (!linkId || !canManage) return; const slug = window.prompt("New draft slug", `${document.link.public_slug}-copy`); if (!slug) return;
    setSaving(true); setError(""); try { const response = await fetch(`/api/smart-links/${linkId}/duplicate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: document.link.updated_at, slug }) }); const result = await response.json().catch(() => null) as { smartLink?: Document; error?: string } | null; if (!response.ok || !result?.smartLink) throw new Error(result?.error ?? "Could not duplicate Smart Link."); router.push(`/smart-links/${result.smartLink.link.id}`); } catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "Could not duplicate Smart Link."); } finally { setSaving(false); }
  }
  async function copyUrl() { try { await navigator.clipboard.writeText(`https://artistdeck.app/${document.link.public_slug}`); setNotice("Smart Link URL copied."); } catch { setError("Could not copy the URL. Please copy it manually."); } }
  function back() { if (!dirty || window.confirm("You have unsaved changes. Leave the editor?")) router.push("/smart-links"); }

  if (state === "loading") return <main className="smart-links-editor-state"><LoaderCircle className="is-spinning" aria-hidden size={24} /><p>Loading Smart Link editor…</p></main>;
  if (state === "error") return <main className="smart-links-editor-state"><Link2 aria-hidden size={24} /><strong>The editor couldn’t load</strong><p>{error}</p><button onClick={() => void load()} type="button">Try again</button></main>;
  return <section className="smart-links-editor" aria-label="Smart Link editor">
    <header className="smart-links-editor-header"><button className="smart-links-back" onClick={back} type="button"><ArrowLeft aria-hidden size={17} />Back</button><div className="smart-links-editor-title"><p className="eyebrow">Smart Links · {mode === "new" ? "New draft" : "Editor"}</p><h1>{mode === "new" ? "Create Smart Link" : effectiveTitle(document.link)}</h1></div><div className="smart-links-editor-actions"><span className={`smart-links-status is-${document.link.status}`}>{displayStatus(document.link.status)}</span>{canManage ? <><button className="smart-links-secondary-action" disabled={saving} onClick={() => void save()} type="button"><Save aria-hidden size={15} />Save Draft</button>{document.link.status === "draft" || document.link.status === "disabled" ? <button className="smart-links-primary-action" disabled={saving || Boolean(validation) || !linkId} onClick={() => void transition("published")} type="button"><Radio aria-hidden size={15} />Publish</button> : null}</> : <span className="smart-links-read-only">Viewer access · read-only</span>}</div></header>
    {error ? <p className="smart-links-editor-message is-error" role="alert">{error}</p> : null}{notice ? <p className="smart-links-editor-message" role="status">{notice}</p> : null}
    <div className="smart-links-editor-grid"><div className="smart-links-editor-controls">
      <EditorSection number="01" title="Song and identity" description={selectedSong ? "Linked to the selected Production song." : "Standalone Smart Link."}>
        {mode === "new" ? <SongSourcePicker canManage={canManage} onChoose={(song) => { selectSong(song); setSongPickerOpen(false); }} onOpen={() => setSongPickerOpen(true)} onQueryChange={setSongQuery} open={songPickerOpen} query={songQuery} selectedSong={selectedSong} songs={songs} /> : null}
        {selectedSong ? <p className="smart-links-inheritance"><Check aria-hidden size={14} /><strong>{selectedSong.title}</strong><span>From Production</span></p> : <p className="smart-links-inheritance"><Info aria-hidden size={14} />Standalone · not connected to Production</p>}
        <div className="smart-links-identity-grid"><ArtworkControl disabled={!canManage} linked={Boolean(selectedSong)} link={document.link} onChange={(value) => updateLink({ artwork_url_override: value })} onReset={() => updateLink({ artwork_url_override: "" })} /><div className="smart-links-field-stack"><label>Track title<input disabled={!canManage} onChange={(event) => updateTitle(event.target.value)} placeholder={document.link.source_song_title || "e.g. Midnight Drive"} value={document.link.title_override ?? ""} /><small>{document.link.source_song_title ? document.link.title_override ? "Override" : "From Production" : "Standalone title"}</small>{document.link.source_song_title && document.link.title_override ? <button className="smart-links-inline-reset" disabled={!canManage} onClick={() => updateLink({ title_override: "" })} type="button">Reset to Production value</button> : null}</label><label>Artist name<input disabled={!canManage} onChange={(event) => updateLink({ artist_name_override: event.target.value })} placeholder={document.link.source_artist_name || "e.g. Love Strings"} value={document.link.artist_name_override ?? ""} /><small>{document.link.source_artist_name ? document.link.artist_name_override ? "Override" : "From Production" : "Standalone artist"}</small>{document.link.source_artist_name && document.link.artist_name_override ? <button className="smart-links-inline-reset" disabled={!canManage} onClick={() => updateLink({ artist_name_override: "" })} type="button">Reset to Production value</button> : null}</label></div></div>
      </EditorSection>
      <EditorSection number="02" title="Link address" description="The address stays editable until the link has been published for the first time."><label>Public address<div className="smart-links-slug-field"><span>artistdeck.app/</span><input disabled={!canManage || lockedSlug} onChange={(event) => updateLink({ public_slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="midnight-drive" value={document.link.public_slug} />{lockedSlug ? <Lock aria-label="Slug locked after publication" size={16} /> : null}</div></label>{lockedSlug ? <p className="smart-links-inheritance"><Lock aria-hidden size={14} />This slug is permanently locked because the link was published.</p> : null}<button className="smart-links-text-action" disabled={!document.link.public_slug} onClick={() => void copyUrl()} type="button"><Copy aria-hidden size={14} />Copy URL</button></EditorSection>
      <EditorSection number="04" title="Appearance" description="Only saved appearance fields are shown here."><div className="smart-links-choice-row"><label><input checked={document.link.background_mode === "blurred-artwork"} disabled={!canManage} name="background" onChange={() => updateLink({ background_mode: "blurred-artwork" })} type="radio" />Artwork glow</label><label><input checked={document.link.background_mode === "solid-color"} disabled={!canManage} name="background" onChange={() => updateLink({ background_mode: "solid-color" })} type="radio" />Solid color</label></div>{document.link.background_mode === "solid-color" ? <label>Background color<input disabled={!canManage} onChange={(event) => updateLink({ background_color: event.target.value })} pattern="#[0-9a-fA-F]{6}" placeholder="#101315" value={document.link.background_color ?? ""} /></label> : null}<p className="smart-links-future-note"><Info aria-hidden size={14} />Button theme, typography, layout variants and social icons are future capabilities; they need approved schema work before they can be saved.</p></EditorSection>
      <EditorSection number="03" title="Streaming destinations" description="Up to six saved destinations. Order and visibility update the preview immediately; disabling preserves its history."><div className="smart-links-destination-list">{document.destinations.map((destination, index) => <DestinationControl canManage={canManage} destination={destination} index={index} key={destination.id ?? `${destination.platform_key}-${index}`} onMove={moveDestination} onUpdate={updateDestination} total={document.destinations.length} />)}</div>{canManage && document.destinations.length < 6 ? <div className="smart-links-add-destination">{platforms.filter((platform) => !document.destinations.some((item) => item.platform_key === platform.key)).map((platform) => <button key={platform.key} onClick={() => addDestination(platform.key)} type="button"><Plus aria-hidden size={14} />{platform.label}</button>)}</div> : null}</EditorSection>
      <EditorSection number="05" title="Tracking settings" description="This configures saved Meta Pixel settings only. Tracking and consent execution arrive later."><label>Meta Pixel mode<select disabled={!canManage} onChange={(event) => updateLink({ pixel_mode: event.target.value as LinkRecord["pixel_mode"], pixel_override_id: event.target.value === "override" ? document.link.pixel_override_id : "" })} value={document.link.pixel_mode}><option value="inherit">Inherit workspace default</option><option value="override">Override for this link</option><option value="disabled">Disable for this link</option></select></label>{document.link.pixel_mode === "override" ? <label>Override Pixel ID<input disabled={!canManage} inputMode="numeric" onChange={(event) => updateLink({ pixel_override_id: event.target.value })} placeholder="123456789012345" value={document.link.pixel_override_id ?? ""} /></label> : null}</EditorSection>
      {linkId ? <EditorSection number="06" title="Publishing and lifecycle" description="Publishing is available now; the public landing page itself arrives in Phase 3."><div className="smart-links-lifecycle-actions">{document.link.status === "published" ? <button disabled={!canManage || saving} onClick={() => void transition("disabled")} type="button">Disable link</button> : null}{document.link.status === "disabled" ? <button disabled={!canManage || saving} onClick={() => void transition("published")} type="button">Enable and publish</button> : null}{document.link.status === "archived" ? <button disabled={!canManage || saving} onClick={() => void transition("disabled")} type="button"><RotateCcw aria-hidden size={14} />Restore link</button> : null}{document.link.status !== "archived" ? <button disabled={!canManage || saving} onClick={() => void transition("archived")} type="button"><Archive aria-hidden size={14} />Archive link</button> : null}<button disabled={!canManage || saving} onClick={() => void duplicate()} type="button"><Copy aria-hidden size={14} />Duplicate draft</button></div></EditorSection> : null}
    </div><aside className="smart-links-preview-column"><div className="smart-links-preview-sticky"><div className="smart-links-preview-label"><Eye aria-hidden size={15} />Live mobile preview <span>Local only</span></div><SmartLinkPreview artwork={effectiveArtwork(document.link)} artist={effectiveArtist(document.link)} backgroundColor={document.link.background_mode === "solid-color" ? document.link.background_color : null} destinations={activeDestinations} title={effectiveTitle(document.link)} /></div></aside></div>
  </section>;
}

function EditorSection({ children, description, number, title }: { children: React.ReactNode; description: string; number: string; title: string }) { return <section className="smart-links-editor-section"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header>{children}</section>; }
function SongSourcePicker({ canManage, onChoose, onOpen, onQueryChange, open, query, selectedSong, songs }: { canManage: boolean; onChoose: (song: Song | null) => void; onOpen: () => void; onQueryChange: (value: string) => void; open: boolean; query: string; selectedSong: Song | undefined; songs: Song[] }) { const visible = songs.filter((song) => song.title.toLowerCase().includes(query.toLowerCase())); return <div className="smart-links-source-picker"><label>Source song<div className="smart-links-source-search"><Search aria-hidden size={15} /><input disabled={!canManage} onChange={(event) => onQueryChange(event.target.value)} onFocus={onOpen} placeholder={selectedSong ? "Search to change source song…" : "Search ArtistDeck songs…"} value={query} /></div></label>{open ? <div className="smart-links-source-results"><button disabled={!canManage} onClick={() => onChoose(null)} type="button"><span className="smart-links-platform-mark"><Plus aria-hidden size={14} /></span><span><strong>Start from scratch</strong><small>Another song or an independent Smart Link</small></span></button>{visible.map((song) => <button disabled={!canManage} key={song.id} onClick={() => onChoose(song)} type="button"><span className="smart-links-source-art">{song.album_art_url ? <img alt="" src={song.album_art_url} /> : <Music2 aria-hidden size={15} />}</span><span><strong>{song.title}</strong><small>Use Production artwork and details</small></span></button>)}{visible.length === 0 ? <p>No matching ArtistDeck songs.</p> : null}</div> : null}</div>; }
function ArtworkControl({ disabled, linked, link, onChange, onReset }: { disabled: boolean; linked: boolean; link: LinkRecord; onChange: (value: string) => void; onReset: () => void }) { const artwork = effectiveArtwork(link); const field = <label>Artwork URL<input disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={link.source_artwork_url || "https://…"} value={link.artwork_url_override ?? ""} /></label>; return <div className="smart-links-artwork-control"><span className="smart-links-editor-artwork">{artwork ? <img alt="Current cover artwork" src={artwork} /> : <ImagePlus aria-hidden size={24} />}</span>{linked ? <details><summary>Override artwork</summary>{field}{link.artwork_url_override ? <button className="smart-links-inline-reset" disabled={disabled} onClick={onReset} type="button">Reset to Production value</button> : null}</details> : field}</div>; }
function PlatformMark({ label, platform }: { label: string; platform: Platform }) { const logo = platform === "custom" && /youtube/i.test(label) ? "https://cdn.simpleicons.org/youtube/FF0000" : platformLogoUrls[platform]; return logo ? <img alt="" src={logo} /> : <span aria-hidden>{platformByKey[platform].mark}</span>; }
function DestinationControl({ canManage, destination, index, onMove, onUpdate, total }: { canManage: boolean; destination: Destination; index: number; onMove: (index: number, delta: number) => void; onUpdate: (index: number, patch: Partial<Destination>) => void; total: number }) { const platform = platformByKey[destination.platform_key]; return <article className="smart-links-destination-control"><div className="smart-links-destination-top"><span className="smart-links-platform-mark"><PlatformMark label={destination.button_label || platform.label} platform={destination.platform_key} /></span><strong>{platform.label}</strong><label className="smart-links-toggle">Visible<input checked={destination.is_enabled} disabled={!canManage} onChange={(event) => onUpdate(index, { is_enabled: event.target.checked })} type="checkbox" /></label></div><label>Button label<input disabled={!canManage} onChange={(event) => onUpdate(index, { button_label: event.target.value })} value={destination.button_label} /></label><label>Destination URL<input disabled={!canManage} onChange={(event) => onUpdate(index, { target_url: event.target.value })} placeholder="https://…" type="url" value={destination.target_url} /></label><div className="smart-links-destination-tools"><GripVertical aria-hidden size={16} /><button aria-label={`Move ${platform.label} up`} disabled={!canManage || index === 0} onClick={() => onMove(index, -1)} type="button"><ArrowUp aria-hidden size={14} /></button><button aria-label={`Move ${platform.label} down`} disabled={!canManage || index === total - 1} onClick={() => onMove(index, 1)} type="button"><ArrowDown aria-hidden size={14} /></button></div></article>; }
function SmartLinkPreview({ artwork, artist, backgroundColor, destinations, title }: { artwork: string | null | undefined; artist: string; backgroundColor: string | null; destinations: Destination[]; title: string }) { return <div className="smart-links-phone" style={backgroundColor ? { background: backgroundColor } : undefined}><div className="smart-links-phone-glow" style={artwork && !backgroundColor ? { backgroundImage: `url(${artwork})` } : undefined} /><div className="smart-links-phone-content"><div className="smart-links-phone-brand">ArtistDeck</div><div className="smart-links-phone-artwork">{artwork ? <img alt="" src={artwork} /> : <Link2 aria-hidden size={42} />}</div><h2>{title}</h2><p>{artist}</p><div className="smart-links-phone-panel">{destinations.length ? destinations.map((destination) => { const label = destination.button_label || platformByKey[destination.platform_key].label; return <div className="smart-links-phone-destination" key={destination.id ?? `${destination.platform_key}-${destination.position}`}><span><b><PlatformMark label={label} platform={destination.platform_key} /></b>{label}</span><button type="button">{destination.platform_key === "custom" ? "Open" : "Play"}</button></div>; }) : <span className="smart-links-phone-empty">Enable a destination to preview it here.</span>}</div><small>Terms&nbsp; · &nbsp;Privacy<br />Powered by ArtistDeck.app</small></div></div>; }

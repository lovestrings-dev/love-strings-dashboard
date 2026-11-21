import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  enabledDestinationPlatforms,
  filterAndSortSmartLinks,
  smartLinkArtist,
  smartLinkPreviewFixtures,
  smartLinkTitle
} from "../lib/smart-links-library.ts";

const links = [
  { id: "1", public_slug: "late-night", status: "published", source_song_title: "Late Night", source_artist_name: "Love Strings", title_override: null, artist_name_override: null, source_artwork_url: null, artwork_url_override: null, created_at: "2026-11-02T00:00:00.000Z", updated_at: "2026-11-20T00:00:00.000Z" },
  { id: "2", public_slug: "open-sky", status: "draft", source_song_title: "Open Sky", source_artist_name: "Love Strings", title_override: "Open Sky (Acoustic)", artist_name_override: null, source_artwork_url: null, artwork_url_override: null, created_at: "2026-11-21T00:00:00.000Z", updated_at: "2026-11-21T00:00:00.000Z" }
];

assert.equal(smartLinkTitle(links[1]), "Open Sky (Acoustic)");
assert.equal(smartLinkArtist(links[0]), "Love Strings");
assert.deepEqual(filterAndSortSmartLinks(links, "late", "all", "updated").map((link) => link.id), ["1"]);
assert.deepEqual(filterAndSortSmartLinks(links, "", "draft", "title").map((link) => link.id), ["2"]);
assert.deepEqual(enabledDestinationPlatforms([{ platform_key: "spotify", is_enabled: true, retired_at: null }, { platform_key: "deezer", is_enabled: false, retired_at: null }, { platform_key: "custom", is_enabled: true, retired_at: "2026-11-01T00:00:00.000Z" }]), ["spotify"]);
assert.equal(smartLinkPreviewFixtures.length, 6);
assert.deepEqual(new Set(smartLinkPreviewFixtures.map((link) => link.status)), new Set(["draft", "published", "disabled", "archived"]));

const library = readFileSync(new URL("../app/components/smart-links-library.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/smart-links/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/components/smart-links-shell.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../app/components/smart-link-editor.tsx", import.meta.url), "utf8");
assert.match(library, /\/api\/smart-links/);
assert.match(library, /smartLinksPreview/);
assert.match(library, /process\.env\.NODE_ENV === "development"/);
assert.match(library, /Sample actions are disabled/);
assert.match(library, /navigator\.clipboard\.writeText/);
assert.match(library, /window\.confirm/);
assert.match(page, /SmartLinksShell/);
assert.match(shell, /AccountControl/);
assert.match(editor, /\/api\/smart-links\/production-songs/);
assert.match(editor, /expectedUpdatedAt/);
assert.match(editor, /smart-links-phone/);
assert.match(editor, /beforeunload/);
assert.match(editor, /Search ArtistDeck songs/);
assert.match(editor, /Start from scratch/);
assert.match(editor, /onFocus=\{onOpen\}/);
assert.match(editor, /\/api\/smart-links\/production-songs/);
assert.match(editor, /initialMode === "linked"/);
assert.match(editor, /toSlug\(song\.title\)/);

console.log("Smart Links Phase 2 library/editor UI checks passed.");

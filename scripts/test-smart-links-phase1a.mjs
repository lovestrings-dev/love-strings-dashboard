import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261119160000_create_smart_links_foundation.sql", import.meta.url),
  "utf8"
);

for (const table of [
  "smart_links",
  "smart_link_destinations",
  "smart_link_daily_metrics",
  "smart_link_destination_daily_metrics",
  "workspace_meta_pixel_settings"
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "i"), `${table} is created`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} has RLS`);
}

assert.match(migration, /foreign key \(production_song_id, workspace_id\)[\s\S]*references public\.production_songs\(id, workspace_id\)[\s\S]*on delete set null \(production_song_id\)/i, "song references are tenant-safe and deletion-resilient");
assert.match(migration, /unique index smart_links_public_slug_key on public\.smart_links\(public_slug\)/i, "public slugs are globally unique");
for (const reservedPath of ["artistdeck", "terms", "privacy"]) {
  assert.match(migration, new RegExp(`'${reservedPath}'`, "i"), `${reservedPath} is reserved`);
}
assert.match(migration, /Published Smart Link slugs are immutable/i, "published slugs are locked");
assert.match(migration, /Smart Links must be created as Drafts/i, "links begin as drafts");
assert.match(migration, /old\.status = 'archived' and new\.status in \('archived', 'disabled'\)/i, "archived draft restoration is controlled");
assert.match(migration, /unique \(smart_link_id, platform_key\)/i, "each platform has one destination slot");
assert.match(migration, /'spotify', 'apple_music', 'youtube_music',[\s\S]*'amazon_music', 'deezer', 'custom'/i, "only the six approved destination keys exist");
assert.match(migration, /unique \(smart_link_id, position\) deferrable initially immediate/i, "destination ordering is transaction-safe");
assert.match(migration, /metric_date date not null,[\s\S]*metric_timezone text not null/is, "metrics preserve local-date timezone meaning");
assert.match(migration, /create or replace function public\.increment_smart_link_page_view\(p_public_slug text\)/i, "page-view increment RPC exists");
assert.match(migration, /create or replace function public\.increment_smart_link_destination_click\([\s\S]*p_destination_id uuid/i, "destination-click increment RPC exists");
assert.match(migration, /timezone\(v_timezone, now\(\)\)::date/i, "metric date is server-derived from trusted workspace settings");
assert.match(migration, /after update of title, album_art_url on public\.production_songs/i, "song changes synchronize Smart Link snapshots");
assert.match(migration, /when \([\s\S]*old\.title is distinct from new\.title[\s\S]*or old\.album_art_url is distinct from new\.album_art_url[\s\S]*\)/i, "no-op source-song updates skip Smart Link synchronization");
assert.match(migration, /source_song_title = new\.title,[\s\S]*source_artwork_url = new\.album_art_url/is, "song synchronization preserves overrides by updating only source fields");
assert.match(migration, /Workspace members can read Smart Links/i, "workspace member read policy exists");
assert.doesNotMatch(migration, /Workspace editors can (create|update) Smart Links/i, "authenticated Smart Link mutations are absent");
assert.match(migration, /revoke insert, update, delete, truncate, references, trigger on table[\s\S]*from authenticated/i, "authenticated mutation privileges are revoked");
assert.match(migration, /grant select on table[\s\S]*to authenticated/i, "authenticated workspace reads retain table privileges");
assert.match(migration, /grant select, insert, update, delete on table[\s\S]*to service_role/i, "service role retains table mutations");
assert.doesNotMatch(migration, /on public\.smart_links for delete/i, "ordinary Smart Link deletion is not exposed");
assert.match(migration, /A Smart Link destination cannot be moved to another Smart Link/i, "destination metrics cannot be re-parented");
assert.match(migration, /A Smart Link destination with historical metrics cannot be deleted/i, "destination metrics are deletion-protected");
assert.match(migration, /set search_path = pg_catalog, public, pg_temp/i, "privileged functions use a controlled search path");
assert.match(migration, /revoke all on function public\.increment_smart_link_page_view\(text\) from public, anon, authenticated/i, "counter RPC is private");
assert.match(migration, /grant execute on function public\.increment_smart_link_page_view\(text\) to service_role/i, "counter RPC is service-role-only");
assert.doesNotMatch(migration, /to anon\s+using \(true\)/i, "no anonymous read policy is introduced");

console.log("Smart Links Phase 1A migration contract checks passed.");

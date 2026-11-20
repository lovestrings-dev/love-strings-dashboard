import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");

const [migration, helpers, mutationRoute, detailRoute, pixelRoute, runtimeSuite, workflow] = await Promise.all([
  read("supabase/migrations/20261120171244_smart_links_management_rpc.sql"),
  read("lib/server/smart-links.ts"),
  read("app/api/smart-links/route.ts"),
  read("app/api/smart-links/[smartLinkId]/route.ts"),
  read("app/api/workspace/meta-pixel/route.ts"),
  read("supabase/tests/smart-links-phase1b.behavior.sql"),
  read(".github/workflows/artistdeck-smart-links-db-tests.yml")
]);

assert.match(migration, /security definer/);
assert.match(migration, /set search_path = pg_catalog, public, pg_temp/);
assert.match(migration, /revoke all on function public\.smart_link_management_mutate[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.smart_link_management_mutate[\s\S]*to service_role/);
assert.match(migration, /for update/);
assert.match(migration, /v_role is null or v_role not in \('admin', 'member'\)/);
assert.match(migration, /set constraints smart_link_destinations_position_key deferred/);
assert.match(migration, /p_action in \('update', 'transition', 'duplicate'\)/);
assert.match(migration, /source_song_title, source_artist_name, source_artwork_url/);
assert.match(helpers, /const reservedSlugs = new Set/);
assert.match(helpers, /"artistdeck"/);
assert.match(helpers, /parsed\.protocol !== "https:"/);
assert.match(helpers, /A Smart Link supports at most six destination slots/);
assert.match(helpers, /Each Smart Link destination platform may be used once/);
assert.match(helpers, /Smart Link destination positions must be unique/);
assert.match(helpers, /Meta Pixel ID must contain 5 to 32 digits/);
assert.match(helpers, /if \(access\.role === "viewer"\)/);
assert.match(mutationRoute, /requireSmartLinkManager/);
assert.match(detailRoute, /validateRevision/);
assert.match(pixelRoute, /smart_link_update_workspace_pixel_settings/);
assert.match(runtimeSuite, /v_viewer/);
assert.match(runtimeSuite, /v_non_member/);
assert.match(runtimeSuite, /serialization_failure/);
assert.match(runtimeSuite, /duplicate preserves fallback snapshots after source-song deletion/);
assert.match(runtimeSuite, /set local role authenticated/);
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /\bpush:|\bpull_request:/);
assert.match(workflow, /permissions:\n  contents: read/);
assert.match(workflow, /supabase --workdir .* start/);
assert.match(workflow, /smart-links-bootstrap\.sql/);
assert.match(workflow, /20261119160000_create_smart_links_foundation\.sql/);
assert.match(workflow, /20261120171244_smart_links_management_rpc\.sql/);
assert.doesNotMatch(workflow, /supabase db reset/);
assert.match(workflow, /127\.0\.0\.1:54322/);

console.log("Smart Links Phase 1B server-contract checks passed.");

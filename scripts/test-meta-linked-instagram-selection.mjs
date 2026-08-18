import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202608170002_meta_linked_instagram_selection.sql", import.meta.url), "utf8");
const correctiveMigration = await readFile(new URL("../supabase/migrations/202608170004_meta_authoritative_state_and_rebinding.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/integrations/meta/fstats-login/selection/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/integrations/meta/fstats-login/callback/route.ts", import.meta.url), "utf8");
const oauth = await readFile(new URL("../lib/meta/fstats-login-oauth.ts", import.meta.url), "utf8");

assert.match(migration, /app_meta_active_instagram_bindings/, "linked Instagram has a global active-binding guard");
assert.match(migration, /pg_advisory_xact_lock/, "linked Instagram selection is race-safe");
assert.match(migration, /parent_page_external_id/, "the binding records its selected Page parent");
assert.match(migration, /p_instagram_external_id/, "selection uses the stable Instagram ID");
assert.doesNotMatch(migration, /username.*conflict/i, "username is never an identity key");
assert.match(oauth, /instagram_business_account/, "discovery reads the Page-linked Instagram relation");
assert.match(route, /connect_instagram/, "the Admin API requires an explicit Instagram acceptance action");
assert.match(route, /pageExternalId/, "selection is scoped to the selected Page");
assert.match(route, /skip_instagram/, "the Admin API persists an explicit Instagram Skip action");
assert.match(callback, /runLinkedInstagramDiscovery/, "callback reconciliation uses the shared discovery state rules");
assert.match(correctiveMigration, /selected_linked_instagram_missing/, "a missing selected Instagram is marked for review");
assert.match(correctiveMigration, /delete from public\.app_meta_active_instagram_bindings/, "an invalid selected Instagram binding is cleared safely");

console.log("Meta linked Instagram selection tests passed.");

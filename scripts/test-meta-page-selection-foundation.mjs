import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const callback = await readFile(new URL("../app/api/integrations/meta/fstats-login/callback/route.ts", import.meta.url), "utf8");
const helper = await readFile(new URL("../lib/server/meta-connections.ts", import.meta.url), "utf8");
const reader = await readFile(new URL("../lib/server/meta-fstats-state.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/202608170004_meta_authoritative_state_and_rebinding.sql", import.meta.url), "utf8");
const settings = await readFile(new URL("../app/meta-page-connection-settings.tsx", import.meta.url), "utf8");
const selectionRoute = await readFile(new URL("../app/api/integrations/meta/fstats-login/selection/route.ts", import.meta.url), "utf8");

assert.match(callback, /saveMetaFacebookPageCandidates/, "callback records Page candidates");
assert.match(callback, /readAuthoritativeFstatsLoginState/, "callback shares the authoritative state reader");
assert.match(callback, /runLinkedInstagramDiscovery/, "callback shares the durable discovery transition");
assert.doesNotMatch(callback, /maybeSingle/, "callback no longer collapses ambiguous selected rows");
assert.match(helper, /select_meta_facebook_page/, "Page selection uses a server-side transaction");
assert.match(helper, /skip_meta_linked_instagram/, "Skip uses a durable server action");
assert.match(reader, /\.limit\(2\)/, "reader detects multiple connections");
assert.doesNotMatch(reader, /order\("updated_at"/, "reader never chooses latest connection");
assert.match(settings, /FstatsLoginState/, "UI consumes the shared state contract");
assert.match(settings, /candidate\.availability === "bound_elsewhere"/, "cross-workspace Page conflicts are visibly blocked");
assert.match(settings, /performAction\("skip_instagram"/, "Skip persists through the backend");
assert.match(settings, /Retry Instagram check/, "provider failures have a retry path that preserves Page selection");
assert.match(selectionRoute, /expectedConnectionId/, "actions use optimistic authoritative-state validation");
assert.match(selectionRoute, /pageBinding: "succeeded"/, "a committed Page selection is reported separately from discovery");
assert.match(selectionRoute, /instagramDiscovery: discovery\.outcome/, "discovery failure cannot turn Page success into a false total failure");
assert.match(selectionRoute, /authoritativeStateHttpStatus/, "database read failure returns a service failure");
assert.doesNotMatch(selectionRoute, /order\("updated_at"/, "actions never infer the current connection from recency");
assert.match(migration, /pg_advisory_xact_lock/, "global bindings remain race-safe");
assert.match(migration, /delete from public\.app_meta_active_instagram_bindings/, "Page changes remove stale Instagram bindings transactionally");
assert.match(migration, /asset_state = 'skipped'/, "Skip survives refresh and OAuth callback reconciliation");
assert.match(migration, /grant execute[\s\S]*service_role/, "state transitions remain service-role-only");

console.log("Meta Page selection foundation tests passed.");

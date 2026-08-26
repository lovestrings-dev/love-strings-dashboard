import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, preferences, route] = await Promise.all([
  readFile(new URL("../supabase/migrations/202608260004_add_versioned_dashboard_preference_templates.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/dashboard-preferences.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/platform/default-dashboard-preferences/route.ts", import.meta.url), "utf8")
]);

for (const id of ["events", "focus", "production", "production.current-song", "marketing", "marketing.current-song", "platforms", "platforms.audience", "platforms.instagram-creator", "platforms.youtube", "platforms.youtube-topic", "platforms.spotify", "budget", "roadmap", "qr-codes"]) {
  assert.match(preferences, new RegExp(`id: "${id}"`));
  assert.match(migration, new RegExp(`"${id}"`));
}
assert.match(migration, /create table public\.platform_dashboard_preference_templates/i);
assert.match(migration, /seeded_template_version integer/);
assert.match(migration, /seed_dashboard_preferences_from_active_default/);
assert.match(migration, /activate_platform_dashboard_preference_template/);
assert.match(migration, /create or replace function public\.accept_workspace_invitation/i);
assert.match(migration, /create or replace function public\.enrol_love_strings_user/i);
assert.match(migration, /create or replace function public\.provision_workspace/i);
assert.match(route, /requirePlatformOwner/);
assert.match(route, /activate_platform_dashboard_preference_template/);

console.log("Versioned dashboard preference template checks passed.");

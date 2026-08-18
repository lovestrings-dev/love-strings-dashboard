import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/202608180002_reconcile_lovestrings_instagram_historical_account.sql", import.meta.url),
  "utf8"
);

assert.match(migration, /v_historical_account_id uuid := 'e529c347-7306-49ed-b500-532fd259e5a2'/);
assert.match(migration, /v_duplicate_account_id uuid := '8040094c-c1ac-45d7-a53c-5f2f98af2d52'/);
assert.match(migration, /v_snapshot_count <> 182/, "migration refuses an unexpected historical snapshot count");
assert.match(migration, /v_content_count <> 23/, "migration refuses an unexpected historical content count");
assert.match(migration, /update public\.platform_accounts set meta_external_id = null where id = v_duplicate_account_id;/);
assert.match(migration, /update public\.platform_accounts set meta_external_id = v_meta_external_id where id = v_historical_account_id;/);
assert.match(migration, /update public\.app_meta_connection_accounts set platform_account_id = v_historical_account_id/);
assert.match(migration, /delete from public\.platform_accounts where id = v_duplicate_account_id;/);
assert.match(migration, /account_name = public\.platform_accounts\.account_name/);
assert.match(migration, /external_id = case when public\.platform_accounts\.external_id is null/);
assert.match(migration, /on conflict \(workspace_id, platform_id, meta_external_id\) where meta_external_id is not null/);
assert.match(migration, /hashtextextended\('instagram:' \|\| v_meta_external_id, 0\)/);

console.log("Meta Instagram account reconciliation migration checks passed.");

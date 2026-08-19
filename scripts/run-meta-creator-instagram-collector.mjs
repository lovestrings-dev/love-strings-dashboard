import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

import { decryptMetaTokenPayload } from "../lib/meta/tokens.ts";

const workspaceId = process.env.META_CREATOR_INSTAGRAM_TEST_WORKSPACE_ID ?? "00000000-0000-0000-0000-000000000001";
if (!process.argv.includes("--apply")) throw new Error("Refusing to write. Re-run with --apply for an intentional Standalone Instagram collector test.");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service configuration is unavailable.");

globalThis.__collectorDeps = {
  decryptMetaTokenPayload,
  defaultWorkspaceTimeZone: "Europe/Vienna",
  getWorkspaceDateKey: (timeZone) => {
    const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone, year: "numeric" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  },
  resolveTimeZone: (value) => value || null
};
let source = await readFile(new URL("../lib/metrics/meta-creator-instagram-collector.ts", import.meta.url), "utf8");
source = source.replace(/import type[^\n]+\n/, "").replace(/import \{ decryptMetaTokenPayload \}[^\n]+\n/, "const { decryptMetaTokenPayload } = globalThis.__collectorDeps;\n").replace(/import \{ defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone \}[^\n]+\n/, "const { defaultWorkspaceTimeZone, getWorkspaceDateKey, resolveTimeZone } = globalThis.__collectorDeps;\n");
const { refreshMetaCreatorInstagramMetrics } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "strip" })).toString("base64")}`);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const result = await refreshMetaCreatorInstagramMetrics(workspaceId, client);
console.log(JSON.stringify(result, null, 2));

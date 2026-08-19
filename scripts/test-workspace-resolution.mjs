import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseWorkspaceId, resolveWorkspaceMembership } from "../lib/workspace.ts";

const firstWorkspaceId = "11111111-1111-4111-8111-111111111111";
const secondWorkspaceId = "22222222-2222-4222-8222-222222222222";
const staleWorkspaceId = "33333333-3333-4333-8333-333333333333";
const memberships = [
  { workspace_id: firstWorkspaceId, role: "admin" },
  { workspace_id: secondWorkspaceId, role: "member" }
];

assert.deepEqual(resolveWorkspaceMembership([memberships[0]], null), memberships[0], "no cookie selects the only membership");
assert.deepEqual(resolveWorkspaceMembership(memberships, secondWorkspaceId), memberships[1], "a valid selected workspace remains selected");
assert.deepEqual(resolveWorkspaceMembership(memberships, staleWorkspaceId), memberships[0], "a stale valid UUID falls back to the first membership");
assert.deepEqual(resolveWorkspaceMembership(memberships, parseWorkspaceId("not-a-uuid")), memberships[0], "a malformed cookie falls back to the first membership");
assert.equal(resolveWorkspaceMembership([], staleWorkspaceId), null, "zero memberships remain unresolved");

const [proxy, workspaceOwner] = await Promise.all([
  readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/server/workspace-owner.ts", import.meta.url), "utf8")
]);

for (const [name, source] of [["proxy", proxy], ["workspace owner", workspaceOwner]]) {
  assert.match(source, /resolveWorkspaceMembership\(memberships, requestedWorkspaceId\)/, `${name} uses shared resolution semantics`);
}

console.log("Workspace resolution checks passed.");

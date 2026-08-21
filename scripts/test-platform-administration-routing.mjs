import assert from "node:assert/strict";
import { isPlatformAdministrationPath } from "../lib/platform-administration-routing.ts";

assert.equal(isPlatformAdministrationPath("/platform"), true);
assert.equal(isPlatformAdministrationPath("/api/platform/workspaces"), true);
assert.equal(isPlatformAdministrationPath("/api/platform"), false);
assert.equal(isPlatformAdministrationPath("/"), false);
assert.equal(isPlatformAdministrationPath("/api/workspaces"), false);
assert.equal(isPlatformAdministrationPath("/api/admin/invitations"), false);
console.log("Platform administration routing boundaries passed.");

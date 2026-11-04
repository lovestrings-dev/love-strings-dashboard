import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, accountControl, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/account-control.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8")
]);

assert.match(page, /<AccountControl[\s\S]*workspaceLogoUrl=\{appLogoUrl\}[\s\S]*workspaceName=\{activeWorkspaceName\}/);
assert.doesNotMatch(page, /<div className="brand-mark">/);
assert.match(accountControl, /className="account-workspace-logo/);
assert.match(accountControl, /Open account menu for \$\{displayName\}/);
assert.match(accountControl, /className=\{`account-avatar/);
assert.match(accountControl, /role="img"/);
assert.doesNotMatch(accountControl, /Hi, \{displayName\}/);
assert.match(styles, /\.account-identity \{[\s\S]*grid-template-columns: 44px minmax\(0, 1fr\) 44px;/);
assert.doesNotMatch(styles, /\.account-workspace-logo\[aria-expanded="true"\]/);
assert.match(styles, /\.account-avatar\[aria-expanded="true"\]/);

assert.doesNotMatch(accountControl, /<select[\s\S]*aria-label="Active workspace"/, "workspace choices do not use a detached native popup");
assert.match(accountControl, /role="menuitemradio"/, "workspace choices report their selected state");
assert.match(accountControl, /aria-checked=\{workspace.id === activeWorkspaceId\}/, "only the active workspace is checked");
console.log("Header account-menu checks passed.");

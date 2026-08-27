import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles, platformPage, platformAdministration] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/platform/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/platform-administration-view.tsx", import.meta.url), "utf8")
]);

assert.match(page, /const \[isAccountIdentityOpen, setIsAccountIdentityOpen\] = useState\(false\)/);
assert.doesNotMatch(page, /ArrowLeft|FloatingNavigationBackButton|user-settings-back|Back to previous app state/);
assert.doesNotMatch(styles, /user-settings-back|app-navigation-back-button-floating/);
assert.doesNotMatch(platformPage, /useRouter|onBack|showBack/);
assert.match(platformAdministration, /export function PlatformAdministrationView\(\)/);

console.log("User Settings disclosure and Back-control checks passed.");

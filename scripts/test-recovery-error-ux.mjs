import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [setPassword, login, styles] = await Promise.all([
  read("app/set-password/page.tsx"),
  read("app/login/page.tsx"),
  read("app/globals.css"),
]);

assert.match(setPassword, /error\.code === "same_password"/, "The Supabase same-password code is handled explicitly");
assert.match(setPassword, /Your new password must be different from your current password\./, "Same-password rejection has the requested user-safe copy");
assert.match(setPassword, /if \(error\) \{[\s\S]*setMessage\(isSamePassword[\s\S]*setIsSubmitting\(false\);[\s\S]*return;/, "Update failures stay on the reset form and release duplicate-submit protection");
assert.doesNotMatch(setPassword, /if \(error\) \{[\s\S]{0,500}setIsInvalidLink\(true\)/, "Same-password rejection is never mapped to the invalid-link state");
assert.match(setPassword, /if \(!session\) return rejectCallback\(\)/, "Genuinely invalid or expired callbacks retain the safe invalid-link state");

assert.match(login, /<button[\s\S]*Sign in[\s\S]*<\/button>[\s\S]*<Link className="auth-form-link auth-form-link-end" href="\/forgot-password">/, "Forgot password is placed below Sign in");
assert.match(styles, /\.auth-form-link-end \{ justify-self: end; \}/, "Forgot password aligns with the form's right edge");

console.log("Recovery error and Login placement UX checks passed.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [login, forgotPassword, setPassword, invitationEmail, authCallback, proxy] = await Promise.all([
  read("app/login/page.tsx"),
  read("app/forgot-password/page.tsx"),
  read("app/set-password/page.tsx"),
  read("lib/server/workspace-invitation-email.ts"),
  read("lib/auth-callback.ts"),
  read("proxy.ts"),
]);

assert.match(login, /href="\/forgot-password"/, "Login exposes a Forgot password action");
assert.match(proxy, /pathname === "\/forgot-password"/, "Forgot-password is accessible before authentication");
assert.match(forgotPassword, /resetPasswordForEmail\(email\.trim\(\), \{ redirectTo \}\)/, "Recovery requests use Supabase resetPasswordForEmail");
assert.match(forgotPassword, /new URL\("\/set-password\?recovery=1", window\.location\.origin\)/, "Recovery redirect is a fixed ArtistDeck-controlled path");
assert.match(forgotPassword, /If an account exists for this email, password reset instructions have been sent\./, "Recovery response is neutral");
assert.doesNotMatch(forgotPassword, /user not found|account does not exist/i, "Recovery response does not enumerate accounts");
assert.match(forgotPassword, /error\.status === 429/, "Rate limiting uses a generic response");

assert.match(setPassword, /const isRecoveryDestination = query\.get\("recovery"\) === "1"/, "Set-password recognizes the fixed recovery destination");
assert.match(setPassword, /if \(ordinary\) \{[\s\S]*fetch\("\/api\/invitations\/accept"/, "Only a workspace invitation invokes acceptance");
assert.match(setPassword, /if \(ordinary && callbackNeedsPassword\(callback\)\)[\s\S]*setFlow\("invitation"\)[\s\S]*else if \(!ordinary && callback && \(isRecoveryDestination \|\| callback\.type === "recovery"\)\)[\s\S]*setFlow\("recovery"\)/, "Invitation callbacks take precedence and recovery never accepts a workspace invitation");
assert.match(setPassword, /exchangeCodeForSession\(callback\.code\)/, "PKCE callback exchange remains supported");
assert.match(setPassword, /setSession\(\{ access_token: callback\.accessToken, refresh_token: callback\.refreshToken \}\)/, "Implicit/hash callbacks remain supported");
assert.match(setPassword, /verifyOtp\(\{ token_hash: callback\.tokenHash, type: callback\.type \}\)/, "Token-hash callbacks remain supported");
assert.match(setPassword, /callback && \(isRecoveryDestination \|\| callback\.type === "recovery"\)/, "PKCE recovery does not rely on type=recovery alone");
assert.match(setPassword, /password !== confirmation/, "Password confirmation mismatch is validated");
assert.match(setPassword, /supabase\.auth\.updateUser\(\{ password \}\)/, "Recovery updates only the authenticated password");
assert.match(setPassword, /setIsResetComplete\(true\)/, "Recovery shows a success state before continuation");
assert.match(setPassword, /Request another reset email/, "Invalid links provide a recovery path");
assert.match(setPassword, /never let User A's existing session consume User B's link/, "Callback session precedence remains documented and preserved");

assert.match(authCallback, /type === "invite" \|\| type === "magiclink" \|\| type === "recovery"/, "Invitation and recovery OTP callbacks remain recognized");
assert.match(invitationEmail, /inviteUserByEmail/, "New-user Invite User delivery is preserved");
assert.match(invitationEmail, /signInWithOtp/, "Existing-user Magic Link invitation fallback is preserved");
assert.match(invitationEmail, /workspace_invitation=\$\{token\}/, "Invitation delivery still carries the isolated workspace token");

console.log("Password recovery flow tests passed.");

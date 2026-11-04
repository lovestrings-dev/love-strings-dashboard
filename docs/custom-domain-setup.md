# ArtistDeck domain setup with existing provider callbacks

Primary app: `https://www.artistdeck.app` (apex redirects to www).
Provider callback host: `https://love-strings-dashboard.vercel.app`.
Both domains must serve the same Vercel project/deployment. Keep the old domain
serving callback requests directly; do not add a whole-domain redirect to www.

## Code behavior

All four provider flows use their existing Vercel callback URLs:

| Provider | Registered callback (unchanged) |
| --- | --- |
| Google | `https://love-strings-dashboard.vercel.app/api/integrations/google/callback` |
| Facebook Login / App B | `https://love-strings-dashboard.vercel.app/api/integrations/meta/fstats-login/callback` |
| Creator Instagram | `https://love-strings-dashboard.vercel.app/api/integrations/meta/instagram/callback` |
| Creator Threads | `https://love-strings-dashboard.vercel.app/api/integrations/meta/threads/callback` |

Provider callback location is independent of `APP_CANONICAL_ORIGIN`, which now
identifies the primary app/allowed return origin, not the provider callback host.
Google and Facebook now use the same fixed-callback attempt mechanism as Creator
Instagram/Threads. The authenticated Admin creates an expiring, single-use attempt
with a hashed random state, initiating user/workspace, required role, and validated
return destination. Google service and Guidance context are stored server-side.
Callbacks atomically consume state and recheck workspace membership/Admin role;
they do not require the initiating domain's cookies or establish a login session.
The proxy permits only the four exact callback paths through to these checks.
Invalid/unverified state gets a JSON error without a user-controlled redirect.
Valid attempts return to their stored origin after success or provider denial.

Invitation/operator defaults and the manual GitHub metrics refresh workflow use
www.artistdeck.app. Old-origin returns and localhost:3000 remain supported.
127.0.0.1 is not an allowed return origin; use localhost:3000 for local OAuth work.

## Step 1: database migration applied (2026-11-04)

Applied `supabase/migrations/202611040001_allow_artistdeck_oauth_return_origin.sql`
to linked project `ezmphpcytohigfdtfvzm` with explicit user authorization.
Verified all 89 existing attempts remain, all context values are objects, the
www origin is allowed, the RPC returns context, anon/authenticated execution
is denied, service_role execution is allowed, and nonexistent state returns no
rows. Migration history contains version `202611040001`.
It adds www to the exact-origin constraint and an object-valued `context` column,
and recreates the service-only fixed-callback consume RPC to return context.
Existing rows receive empty context; existing expiry/replay/integration/user/role
checks and grants remain. The change is transactional and compatible with the
old Creator callback code, which ignores the additional returned field.
Do not edit/replay historical migrations or apply unrelated pending migrations.
Verify remote migration parity and RPC definition/grants after applying.

## Step 2: Supabase Auth settings (user reported complete)

User reported completion on 2026-11-04; not independently inspected.
Set Site URL to `https://www.artistdeck.app`. Add allowed Redirect URLs:

- `https://www.artistdeck.app/set-password`
- `https://www.artistdeck.app/set-password?**` (query-bearing invitation/recovery links)

Retain old production and localhost URLs during transition. This is for app
login/invitation/password recovery; provider callbacks above do not change.

## Step 3: Vercel Production environment

User reported redeployment on 2026-11-04; environment values were not
independently inspected. The required Production values are:

```text
APP_CANONICAL_ORIGIN=https://www.artistdeck.app
NEXT_PUBLIC_SITE_URL=https://www.artistdeck.app
```

Keep all existing provider credentials, encryption keys and Supabase settings.
`.env.example` is updated; it does not modify Vercel or `.env.local`.
Keep apex-to-www redirect and old Vercel domain attached to this same project.
No Google/Meta callback URL edits are required for this approach, provided the
listed Vercel URLs are already registered and remain accepted by those providers.

## Step 4: deploy and verify (requires authorization)

Deploy only after the database and environment are ready. Finish or restart
any in-flight Google/Facebook connections begun before deployment: their old
cookie-based state is not accepted by the new one-time callback flow.

On www, verify login, new/existing-user invitations, password recovery,
Google YouTube and Analytics connect/reconnect, Facebook Page selection,
Creator Instagram and Threads returns, Guided Google return, and metric refresh.
Use designated test accounts/workspaces; no real bindings should be disconnected
just to test. Existing stored tokens are not rewritten by this code change.
Check that callbacks reach handlers without an old-domain login session.
Provider authorization is not verified by local mocked tests.

Review separately configured scheduler/webhook URLs and browser-restricted API
keys if applicable. Repository workflow changes do not update external schedulers.
Existing QR/shared URLs remain on the old host unless separately updated.
Users sign in again on www; browser-only data/preferences do not move domains.

## Recovery

Keep old domains and provider callbacks available. Restore the prior deployment
and previous Vercel environment values if needed. The additive migration may
remain: its extra return field is ignored by old code. Do not rotate keys or
delete bindings as part of rollback. Reconnect attempts interrupted by rollback.

## Local verification

`node scripts/test-custom-domain-oauth.mjs` exercises actual Google/Facebook
route handlers with mocked providers/database, across new-domain start and
old-domain callback without cookies: both Google services, Guidance/ordinary
returns, success/denial, invalid and replayed state, saved identity/workspace,
and Facebook selection return. Creator callback URI helpers and SQL guards
are also checked. Run OAuth helper, Creator, password recovery tests, TypeScript,
ESLint and production build. Database execution and live provider acceptance
remain external validation steps.

## Deployment observation (2026-11-04)

Public checks after the user's redeployment found www reachable with the normal
login redirect, but Google/Facebook callback paths on the old host still
redirected to login. The domain changes were uncommitted locally at that time,
so that redeployment did not demonstrate acceptance of the new callback code.
Deploy the Beta 1.31 commit and repeat acceptance checks.

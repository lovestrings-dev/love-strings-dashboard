# Beta 1.31 release checkpoint

Prepared 4 November 2026. Version `1.31.0-beta.1`; UI **Beta 1.31**.
Status: local release preparation; no push or production deployment claimed.

## Scope

ArtistDeck primary origin is `https://www.artistdeck.app`. Google, Facebook,
Creator Instagram and Threads keep their existing Vercel provider callbacks.
Google/Facebook use expiring, server-bound one-time attempts instead of requiring
initiating-domain cookies at callback. Workspace/user/role/return destination
remain bound to the attempt; Google service/Guidance context is persisted.
Only exact callback routes bypass proxy login; invalid state is rejected.
Invitation/operator URL defaults and the manual metrics workflow use www.
Beta 1.30 chart/campaign behavior is retained.

## Database and configuration

Migration `202611040001` is already applied to linked Supabase project
`ezmphpcytohigfdtfvzm`. Verified unchanged 89 attempt records, object context,
www allowlist, expanded RPC output, service-role-only grants, invalid-state
rejection and no pending migrations. Do not replay or repair migration history.
No provider tokens, credentials or operational records are rewritten.

User reports Supabase Auth URL setup complete and Vercel redeployed; environment
values have not been independently inspected. Required Production values:

```text
APP_CANONICAL_ORIGIN=https://www.artistdeck.app
NEXT_PUBLIC_SITE_URL=https://www.artistdeck.app
```

Keep the old Vercel domain attached without a callback redirect. Provider console
callback settings stay unchanged. See [setup checklist](../custom-domain-setup.md).
No new dependencies; lockfile unchanged. Secrets and `.env.local` are excluded.

## Validation gate

- `pnpm run test:beta131-release`: 20 explicitly allowlisted offline suites,
  including actual Google/Facebook route handlers with mocked database/providers,
  both Google services, guided/ordinary returns, cancellation, replay rejection,
  identity/workspace binding, Creator helpers, OAuth and recovery checks, plus
  the 13 prior chart/campaign regression suites. No live fixtures are executed.
- Typecheck, ESLint, production build and Git diff checks.
- Built About label/version must be Beta 1.31 / `1.31.0-beta.1`.

All 20 suites, typecheck, ESLint, production build and diff checks passed on
4 November 2026. Version guard verifies the About source label and manifest.
Local mocks do not establish live provider acceptance.

## Push and deployment handoff

Prepare a local commit on the existing main branch. Do not include generated
`next-env.d.ts` development-path churn, `.next`, secrets, temporary SQL, or backups.
Push only when authorized: the existing main-branch integration may automatically
start production deployment. Deploy the new release commit, rather than merely
redeploying the previous Beta 1.30 commit `4f3824c`.

## Production acceptance

1. Confirm Vercel deployed the new commit and About shows Beta 1.31.
2. Without signing in, visit old-host Google/Facebook callbacks without state:
   expect HTTP 400 JSON, not a login redirect. Creator paths should also reject
   missing state. App and ordinary API paths must still require login.
3. Sign in at www. Start Google YouTube/Analytics and Facebook connections;
   verify provider authorization uses the old callback host and returns to www
   General Settings/Page selection. Verify guided Google returns its normal cue.
   Test cancellation too. Use designated test accounts/workspaces; do not delete
   real connections to test. Check Creator Instagram/Threads where available.
4. Verify invitations/password recovery return to www; existing workspace data,
   Platforms charts, Marketing, Production and metric refresh still load.
5. Check logs and record acceptance. Restart any OAuth attempts begun before
   deployment: old Google cookie-state attempts are not accepted by the new flow.

## Recovery

Verify the actual prior Vercel deployment before rollback; `4f3824c` is the local
Beta 1.30 predecessor. Restore that deployment and its prior origin environment
settings if required. The additive migration can remain because old Creator
callbacks ignore the extra returned context. Keep both hosts and existing
provider callbacks; do not rotate keys or remove bindings. Restart interrupted
OAuth attempts. No rollback of campaign/metric data is needed.

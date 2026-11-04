# Beta 1.32 release checkpoint

Prepared 4 November 2026. Version `1.32.0-beta.1`; UI **Beta 1.32**.
Status: locally prepared and verified; no push or deployment authorized in this session.

## Scope

- Dark is the default for existing/new accounts without an explicit personal choice. User Settings → Appearance saves light/dark across workspaces/devices. Root cookie rendering applies the last saved skin before paint. Authentication, password, onboarding and platform provisioning screens inherit the shared skin.
- `dark_mode_v1` provides a one-time per-account feature helper in every active workspace, including existing members and viewers. It offers the same toggle and points to User Settings. “Got it” acknowledges it across workspaces/devices; it does not change Getting Started eligibility or progress.
- Avatar/menu on the left, workspace logo on the right, unchanged band-name/ArtistDeck placement. The workspace selector is an expandable in-menu list. Guided onboarding explicitly follows avatar → General Settings → Google Services.
- Produced songs open by default. Marketing day cards open only today when campaign details expand; all other days are collapsed. Current-day scrolling and explicit task/day navigation are retained. No task/date/status data rewrite.
- Budget plots follow Platforms visual styling; monthly bars stay on one row with overflow scrolling for long histories. Existing financial calculations are retained.
- Account menu and About heading read About ArtistDeck.

## Data and configuration

No new dependencies, migrations, provider settings or environment variables.
Existing Supabase server credentials are used by the authenticated own-account
appearance endpoint. Only `artistdeck_theme` and
`artistdeck_dark_mode_v1_acknowledged` presentation metadata are written.
Metadata never grants access. Writes validate the authenticated caller, origin,
write header and allowed payload. Unrelated account metadata is preserved.

The exact `/api/user/appearance` endpoint is allowed after proxy authentication
before workspace membership/write guards so Viewers and operators without a
workspace can change their own skin. The handler still independently validates
Auth and writes. Other workspace routes retain their existing guards.

Legacy dashboard/layout template theme fields remain historical seed values;
account metadata is now the skin source. Accounts need no bulk migration.
Existing Google/Meta callbacks, domain configuration and collection jobs remain
unchanged. Do not replay older data repairs or migrations.

## Validation

- `test:beta132-release`: 27 explicitly allowlisted offline suites passed,
  including appearance defaults, payload/origin rejection, own-user metadata,
  partial saves, acknowledgment, Viewer/operator proxy scope, actual Viewer click-guard behavior, header/Guidance,
  onboarding acceptance, password callback binding and the prior 21 suites.
- Standard `tsc --noEmit`, full ESLint and production Next build passed.
- `git diff --check` passed. About source/package guards check Beta 1.32.
- Mobile browser checks across the work sessions covered dark/light save and
  reload, helper, User Settings, login/recovery, avatar/menu, workspace-list
  expansion, produced-song default, current-day campaign expansion/manual
  toggles/reopen reset and Budget chart appearance. No campaign or budget data
  was edited for verification.
- Full provisioning workspace-list visual acceptance remains to be checked with
  a platform operator; the local browser account sees the access-required page.
  Password callback handling was regression-tested; no live password was changed.

Six numbered duplicate generated `.next` type copies were preserved outside the
build tree under `/tmp/artistdeck-beta132-generated-types-backup` to allow the
standard check. They are build artifacts and are not part of the release.
`next-env.d.ts` development-path churn, secrets, build artifacts and temp files
are excluded from the prepared changes.

## Deployment handoff

Push/deploy only after explicit authorization: pushing the current main branch
may automatically deploy to Vercel. Publish the prepared Beta 1.32 commit rather
than redeploying the existing Beta 1.31 commit `5d6b05c`.

Post-deployment acceptance:

1. Confirm Vercel serves the new commit and About ArtistDeck shows Beta 1.32.
2. An account with no skin preference starts dark. Toggle light in User Settings,
   reload, then switch workspaces; confirm the same personal choice. Verify a
   Viewer can save appearance while workspace writes stay blocked.
3. An account without acknowledgment sees the Dark mode helper. Toggle without
   dismissing, then press Got it and reload; it must stay dismissed. Another
   account should still receive its own helper.
4. Tap the left avatar, expand workspace choices, switch to an authorized
   workspace and verify the checked selection after reload. Check narrow mobile
   and desktop layouts. Confirm the workspace logo is display-only.
5. Verify first-time guidance highlights the avatar, General Settings and the
   existing Google Services destination. Do not disconnect an existing integration
   merely to exercise onboarding.
6. Verify produced songs start expanded; campaign details open only today's card,
   other days toggle independently, reopening resets to today, and Focus Queue
   opens the target day. A campaign outside today's range should start all closed.
7. Inspect Budget charts and compare totals to the prior release. Inspect full
   provisioning forms/list with a platform operator and sign-in/reset forms in
   both skins; do not send invitations or reset emails solely for appearance QA.

## Rollback

Redeploy previously verified Beta 1.31 commit `5d6b05c` if needed. No schema or
configuration rollback is required. Retain personal appearance/acknowledgment
metadata: the old app ignores those keys. Rollback does not rewind ordinary
workspace or account changes made by users after deployment.

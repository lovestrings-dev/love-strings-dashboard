# Beta 1.30 release checkpoint

Prepared 2 November 2026. Version: `1.30.0-beta.1`; UI: **Beta 1.30**.

Status: locally validated release checkpoint; awaiting an explicitly authorized push/deployment. No production deployment is claimed by this document.

## Release scope

- Marketing create-response date normalization prevents newly created song campaign days reverting to July 2026.
- Newly created campaign tasks, including release-day and extra tasks, start Not started.
- Platforms receives canonical Google connection state for YouTube Channel and Website Analytics.
- All ten existing Platforms graph groups use the shared Evolution design: 26 responsive charts, synchronized 30D/90D/1Y/All and Absolute/Growth, exact point inspection, keyboard/touch support, honest missing-data states, paginated chart history and preserved Audience lower/maximum series.
- Spotify's monthly-history versus latest-KPI source/date differences are explained. Existing KPI calculations and collector/import behavior are unchanged.

No new dependencies, environment variables, schema migrations, or scheduled-job changes. Lockfile and migration files are unchanged from the previous checkpoint. Existing Production/share behavior from Beta 1.29 is retained.

## Completed data repairs — do not replay

These were individually authorized and already verified in Love Strings Supabase:

- Just The Two Of Us: 14 campaign days, 25 October–7 November 2026, anchored to release 28 October.
- Pesenka Mamontenka: 14 campaign days, 17–30 November 2026, anchored to release 20 November.
- Pesenka Mamontenka: 16 status changes, with all 47 tasks verified Not started; task details and corrected dates preserved.

The local repair scripts/backups are outside the repository. They are not build inputs, deployment migrations, or release-test steps.

## Local validation

Passed on the prepared application code:

- `pnpm run test:beta130-release`: 13 explicitly allowlisted offline regression suites. The runner does not discover or execute live/fixture mutation scripts.
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `git diff --check`
- Browser About Dashboard shows Beta 1.30.
- Today's browser checks verified connected Google cards, all ten graph groups/26 charts, synchronized controls, actual observation inspection, Audience dual-series values, desktop layout and a 390px viewport without horizontal overflow. Missing Creator/Threads observations remained unavailable. No physical-device rehearsal was performed.

Installed CLIs were invoked directly using bundled Node because the local pnpm launcher previously attempted registry/tooling setup. They run the same commands configured in package.json; no dependency installation or network-dependent test suite was required.

## Deployment handoff

The repository is on `main`. After explicit deployment approval, push the prepared release commit through the existing GitHub Desktop workflow or authenticated Git. Vercel's existing Git integration performs the build/deployment. Pushing `main` can start production deployment, so it is intentionally not part of this preparation task.

Before pushing, check the local commit and any incoming remote changes; do not force-push. Do not include ignored `.env.local`, temporary campaign backups, build output or generated `next-env.d.ts` development-path churn. No environment edit, Supabase push or data repair is needed for this release.

## Production acceptance after Vercel is Ready

1. Confirm the deployment corresponds to the release commit; About Dashboard must show Beta 1.30.
2. Open General Settings and Platforms in a connected workspace. Confirm YouTube Channel and Website Analytics agree about connection state. A configured service with no collected data should remain connected without invented metrics.
3. Open Spotify, another provider graph and Audience. Verify period/mode synchronization, exact recorded observation values, Audience estimate/maximum lines, and unavailable states when history is sparse. Check mobile width and keyboard navigation. Monthly Spotify endpoints need not equal newer KPI observations.
4. In Love Strings, read-check the two repaired campaigns' dates. Do not reset task statuses during smoke testing: legitimate work may have been done since the repair.
5. If a new-campaign persistence smoke test is needed, use a designated disposable test workspace/song with a non-July release date. Create a song campaign through the normal UI; verify all displayed tasks start Not started and day dates remain aligned after refresh. Remove fixtures only through an explicitly authorized cleanup flow. Do not create or delete real campaign data solely for acceptance.
6. Navigate Production, Roadmap, Budget and Dashboard to confirm existing data and controls still load. Do not make unrelated operational edits.
7. Check browser and Vercel errors and record the accepted deployment URL/commit.

## Recovery

The prior local release checkpoint is `4d319c5` (Beta 1.29); verify the actual previous successful Vercel deployment before using it as a rollback target. A code-only rollback can restore that prior Vercel deployment or revert the Beta 1.30 commit in a new commit and deploy it with authorization. No database rollback is needed for the release. The already completed campaign data repairs are independent of the code deployment and should remain intact.

Known limits: Evolution controls persist for the page session, not across reloads; Spotify historical density is limited to saved monthly observations; large histories require paginated read requests. See the Spotify and shared Platforms completion reports for calculation/source details.

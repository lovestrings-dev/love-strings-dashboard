# Beta 1.33 release checkpoint

Prepared 6 November 2026. Version `1.33.0-beta.1`; UI **Beta 1.33**.
Status: local release preparation; no push or deployment authorized.

## Scope

- Repair release-date recalculation for song-local added/deleted steps, preserving completed/custom dates and keeping template scheduling order separate from displayed date order.
- Normalize dates at the API/browser boundary so repeated release edits do not crash on ISO-formatted step dates.
- Prompt Yes/No before Production release-date saves: Yes uses the song's preset schedule, No preserves stored step and Production deadline dates. Marketing/Roadmap still receive the new release date. Existing past-release completion behavior remains.
- Admin settings link opens Production workflow editing and aligns its section header after asynchronous loading. Workspace Members keep the save choices but cannot edit Admin-only defaults.
- Collapsible Production steps with date pickers, status dots and guarded mutation controls; explicit task navigation reveals the relevant card. Shared cards remain read-only with usable disclosure controls.
- Oldest-first release ordering in both Production groups and Dashboard Roadmap preview. Date-ordered step cards/progress boxes, matching main-step colors, and reordered Production steps/Song options controls.
- Marketing day status circles use the same completion calculation as the progress bar. Current-day outlines adapt to the theme, retaining separate gold release-day markers. Full Dashboard campaign artwork matches Production at 84px on mobile.
- Standalone home-screen pull-to-refresh: top-of-page downward pull, release threshold, full page reload. Forms, nested scrolling, horizontal gestures, dialogs, multitouch and normal browser mode are excluded.

## Data and configuration

No migrations, dependencies, credentials, environment variables or external configuration changes. No bulk mutations or repairs to real song dates. Existing authenticated workspace save routes and atomic V1 persistence remain in use. Ordinary edits lazily reconcile the song-local snapshot; workspace templates are not rewritten by song saves. Rollback does not undo user edits made after deployment.

## Validation

- `test:beta133-release`: all 35 explicitly allowlisted offline suites passed, covering the prior release gate plus Production snapshot/date/repeated-save, scheduler, identity, sharing, past-release, Dashboard UI and standalone gesture checks.
- Standard TypeScript (`tsc --noEmit`), full ESLint, production Next build (58 pages) and `git diff --check` all passed.
- Local browser checks during this session verified Production sorting/disclosures, Marketing status circles, dark current-day outline, matching 84px artwork and settings navigation/header alignment. No live song dates were changed by these checks.
- Touch behavior is exercised through isolated event-handler tests. A physical iPhone home-screen test remains necessary after deployment; the desktop browser cannot prove iOS standalone gesture behavior.
- Numbered duplicate generated `.next` type artifacts were preserved under `/tmp/artistdeck-beta133-generated-types-*` before standard checks. Generated `next-env.d.ts` churn is excluded from the release.

## Deployment handoff

Push/deploy only after explicit authorization: pushing main may automatically deploy to Vercel. Verify the deployed commit and About ArtistDeck version.

Post-deployment acceptance:

1. Check Beta 1.33 in About ArtistDeck and sign-in/workspace switching.
2. Rehearse repeated release edits on a disposable song with custom/deleted steps. Check Yes recalculation, No date preservation, reload persistence, Marketing/Roadmap release sync, and retained completed/custom-step dates.
3. Check source-owned shared songs remain editable and received songs read-only. Do not modify Roma's actual release dates solely for QA.
4. Verify oldest-first song/Roadmap order, collapsed steps, date editing, matching status colors and target navigation.
5. Verify Marketing date-header dots/current-day outline in both themes and Dashboard artwork sizing on narrow iPhone screens.
6. From an installed iPhone home-screen app, pull from page top: below-threshold pull cancels, sufficient pull shows Release to refresh, release reloads once. Check scrolling, forms, navigation swipes, dialogs and nested panels. Confirm normal Safari behavior is unaffected.
7. Verify the settings link opens the Production editor at its header for an Admin; Members retain Yes/No without an editable-settings link.

## Rollback

Redeploy Beta 1.32 commit `d517f8a`. No schema/configuration rollback is needed. New song-local snapshot metadata is compatible with the existing model; ordinary workspace/user changes are retained.

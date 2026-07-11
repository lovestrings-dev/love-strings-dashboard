# Love Strings Dashboard Changelog

This file tracks app versions that are useful to discuss, test, and deploy. It is for product-level changes, not every small database edit.

## Beta 1.0

Status: Deployed beta baseline

Includes:
- Dashboard with platform metric cards.
- Marketing campaign tracker with campaign headers, progress bars, editable dates, editable titles, task statuses, extra tasks, and extra campaign days.
- Dashboard campaign preview for previous, current, and next campaigns.
- Supabase-backed shared campaign data for local and deployed app users.
- YouTube metric import script for channel, latest regular video, and latest Short stats.
- Vercel deployment with Basic Auth protection.

## Versioning Rules

- Use `Beta 1.x` for deployed beta builds while the app is still evolving quickly.
- Increase the minor beta number for meaningful UI, backend, API, or workflow updates, for example `Beta 1.1`.
- Do not bump the version for normal app data changes such as editing campaign task names, changing statuses, or adding campaign days.
- Record the version in this changelog, update the visible app label, then commit and deploy.

## Planned Next Versions

## Beta 1.1

Status: Published and verified

Includes:
- UI polishing after the first shared beta test.
- YouTube API upload test with a new video or Short.
- Dashboard verification that latest YouTube names and stats update correctly.
- Instagram API importer for followers, 30-day reach, 30-day views, recent media, and latest Reel/Post views.
- Server-side metric refresh endpoint and manual Dashboard refresh button.
- Album-art URL autosave for Marketing campaign headers.
- Daily scheduled snapshot policy documented.
- Vercel deployment verified with the manual refresh returning `Updated 2 data collectors.`

## Beta 1.2

Status: Published and verified

Release theme:

Control-center concept release for the independent musician dashboard. This beta shows the intended app shape across Dashboard, Marketing, Production, Platforms, Events, Budget, and Roadmap. Some modules are functional prototypes and still need full Supabase persistence in later betas.

Includes:
- First UI-only Production module prototype with workbook-based seed data from `Love Strings ADMIN.xlsx`, song cards, production deadlines, production-step progress, editable notes/deadlines, local Add song, and local Add production step.
- First UI-only Budget module prototype with workbook-based seed data from `Love Strings ADMIN.xlsx`, summary finance cards, editable local ledger, and local Add budget line.
- First UI-only Events module seeded from the Love Strings website archive, with editable event/name/location/address links and manual Add event flow.
- Dashboard command-screen consolidation: next event, compact platform snapshot, campaign previews, current/next production song previews, budget balance cards, and Phase 1 roadmap preview.
- Dashboard Budget preview expanded to four compact cards in one row on desktop: current balance, projected earn, projected spend, and projected balance.
- Dashboard Production cards can expand from 3 next unfinished tasks to the full song task list and collapse back.
- Events can feed generated one-off Budget rows for gig earned/spent values while keeping event-origin Budget rows read-only in the Budget ledger.
- Budget summary cards split actual historical totals from projected future cash flow: actuals include entries through today; projections start tomorrow and look one month ahead.
- Recurring Budget rows can generate monthly/yearly forecast rows, with generated rows kept compact and safely deletable.
- Production steps can generate Budget rows, with default License and Distributor spend values and a one-month visibility window in the Budget ledger.
- Production songs can be safely deleted from the Production catalogue.
- Production now hosts shared song names and album-art URLs for Marketing: new campaigns are created from a Production-song dropdown, title edits use the Production-song dropdown, and Marketing displays Production artwork or an artwork-pending placeholder.
- Apple Music CSV import moved from Dashboard to the Apple Music card in Platforms.
- Apple Music card cleaned up to remove duplicate date/release/file-name text.
- Dashboard platform cards made more compact while keeping the Platforms tab fuller.
- Events summary changed from latest archived event to next upcoming event with weekday and days-left logic.
- Scheduler verification after the next automatic 01:00 Europe/Vienna run.
- Deployment hardening for recurring API imports.

Post-release notes:
- Dashboard, Events, Budget, Roadmap, Production-to-Marketing album art, and Production-to-Marketing song selection passed live smoke testing.
- New Marketing campaign for `Shallow` correctly appeared as 0% complete in production.
- App label was corrected from `Beta 1.1` to `Beta 1.2` after the initial deployment and verified live on the production Vercel URL.
- Follow-up: new Production songs currently default too high in the sorted list; future logic should set the default deadline to the last song deadline plus 2 weeks.
- Follow-up: first two Events cards should align titles with pictograms.
- Follow-up: Platforms graphs need visual refinement, more graph types, and remaining platform connectors.
- Follow-up: Roadmap currently shows the desired visual state but still needs automatic logic.

## Beta 1.3

Release scope:
- Production module becomes Supabase-backed instead of local-only.
- Add normalized Production tables for songs, production steps, extra step tasks, and production budget rows.
- Load Production from Supabase on app startup with local fallback if the schema is unavailable.
- Seed Supabase from the existing workbook-backed Production catalogue when the new Production tables are empty.
- Save Production song title, artwork URL, deadline, steps, statuses, notes, subtasks, and production budget rows through a server-side API route.
- Delete Production songs through the server-side API route.
- Keep browser write access closed for the new Production tables; writes use the server Supabase service key instead of broad anon write policies.
- Fix Add song default deadline so new songs start at the latest existing production deadline plus 2 weeks and naturally stay near the bottom of the Production list.
- Debounce Production saves so fast note edits do not race and overwrite the final text with an older request.
- Keep the active Production song in focus after Add song, deadline changes, step edits, and subtask edits while preserving deadline sorting.
- Keep the active Marketing campaign/day in focus after Add campaign, release date changes, day edits, and task edits while preserving campaign sorting.
- Pin the most recently edited Production song to the top of the Marketing campaign song picker.
- Let Production-generated Budget rows include historical costs and one-month-ahead projected costs, while keeping farther future Production costs out of the current Budget view.
- Add a simple proprietary copyright notice for Dmitrii Baiakin, 1030 Vienna, Austria.

Deployment status:
- Code and migration prepared locally.
- Supabase migration `202607100001_create_production_tracker.sql` applied successfully after confirming the remote push role.
- Local Production persistence verified: notes save to Supabase and remain after refresh.
- Local Production module smoke test passed for add/edit/delete song, deadline changes, album art, budget rows, subtasks, and generated Budget links.
- Ready for GitHub/Vercel Beta 1.3 deployment after final local checks.

## Version 1.0

Planned milestone:

- Internal operating dashboard for Love Strings.
- Platform integrations and platform evolution views.
- Estimated total audience and current budget balance on Dashboard.
- Marketing module refined with Apple Music update reminders.
- Apple Music import moved to Platforms.
- Production planning module.
- Budget tracker.
- Roadmap tracker.
- Events/show tracking module with future persistence.
- Functional Dashboard In Focus section.
- UI tidy-up and mobile polish.

## Version 2.0

Planned milestone:

- Voice-controlled assistant layer for creating and updating real app records.
- Example commands: add show, add marketing task idea, mark production task done.

## Version 3.0

Planned milestone:

- Adapt the app for other musicians if public storytelling creates demand.
- Focus on setup-light onboarding, templates, permissions, and per-artist configuration.

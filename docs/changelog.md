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

Story note:
- Marketing was the first genuinely useful working module. While new modules were still being designed and wired, Yuliia could already use the deployed app in daily campaign work.

## Versioning Rules

- Use `Beta 1.x` for deployed beta builds while the app is still evolving quickly.
- Increase the minor beta number for meaningful UI, backend, API, or workflow updates, for example `Beta 1.1`.
- Do not bump the version for normal app data changes such as editing campaign task names, changing statuses, or adding campaign days.
- Record the version in this changelog, update the visible app label, then commit and deploy.
- Each beta should have one main functional-module headline plus a practical bundle of backlog fixes, UI tweaks, and small cross-module improvements found during testing.

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

Status: Published and verified

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
- GitHub/Vercel deployment completed successfully.

Post-release mobile QA notes:
- Beta 1.4 should focus on mobile layout polish across Dashboard, Marketing, Platforms, Budget, and Roadmap before adding the next major module wiring.

## Beta 1.4

Status: Published and verified

Release theme:

Mobile polish, readability, and shareability pass after real phone testing of Beta 1.3.

Included:
- Visible app label bumped to `Beta 1.4`.
- Love Strings logo added to the app header in place of the note icon.
- Platform names on Dashboard and Platforms are clickable profile links for Instagram, YouTube, YouTube Music, Spotify, Apple Music, Amazon Music, and Deezer.
- Dashboard and Platforms now include a bottom QR Codes dropdown section with editable QR name, QR image URL, and target URL.
- QR Codes section includes default entries for Website, Dashboard, and all current platform profile links; the Website QR is seeded from `public/love-strings-website-qr.png`.
- QR Codes section supports Add QR code and protected Delete with a confirm checkbox.
- QR layout uses four cards per row on desktop and one card per row on mobile.
- Dashboard and Platforms platform cards now use metric subcards for improved readability.
- Platforms metric subcards use two cards per row on mobile instead of horizontal scrolling.
- Marketing tab mobile overflow fixed so campaign cards fit the screen width.
- Dashboard event/focus/platform/marketing/production/budget/roadmap sections were simplified by removing repeated section headings.
- Dashboard Budget preview is arranged as current balance, projected earn/spend, and projected balance for mobile readability.
- Budget tab mobile ledger rows were reworked so long descriptions grow vertically instead of overflowing.
- Roadmap monthly progress no longer shows phase separator lines and reflows more naturally on mobile.

Known follow-ups:
- QR code edits are currently local-browser state; wire to Supabase later if the same QR list should sync across Dmitrii and Yuliia devices.
- Real-phone QA should confirm Dashboard, Marketing, Platforms, Budget, and Roadmap mobile layouts before deeper Beta 1.5 work.
- Metrics scheduler reliability remains under observation after moving from GitHub Actions to Vercel Cron.

Release result:
- GitHub commit/push completed successfully.
- Vercel deployment completed successfully.
- Live app verification passed after deployment.

Post-release reliability update:
- Added Vercel Cron configuration for daily platform metrics refresh at `05:00 UTC`.
- Disabled the GitHub Actions scheduled triggers while keeping manual workflow dispatch as fallback.
- Added an app-open refresh safety check that runs only when today's Europe/Vienna metric snapshot is missing.
- Verified on 2026-07-15 that the Vercel scheduler created fresh Supabase platform metric snapshots automatically around 07:04 Vienna time.

## Beta 1.5

Status: Release candidate prepared locally; Supabase migration applied; local Events smoke test still needed before deploy

Release theme:

Fully functional Events module plus the smaller workflow refinements added after Beta 1.4.

Core scope:
- Wire Events to Supabase so event records, location/address-book details, and event-linked Budget lines can sync across Dmitrii and Yuliia devices.
- Keep Events read/write access server-controlled, following the safer Production-module pattern from Beta 1.3.
- Preserve local fallback behavior while Supabase is unavailable.
- Verify deployed create/edit/delete event flows after release.

Already added locally since Beta 1.4:
- Floating scroll assist button for returning to the opened card header or top of the active tab.
- Events Location Address Book above the Events archive, seeded from existing event data.
- Location records include location name/link, address/link, contact name, contact phone, contact notes, and past event history for the same location.
- New events can choose an existing location from a dropdown; location link, address, and address link autofill from the address book.
- Events budget fields were consolidated into repeatable Budget lines with reason and positive/negative amount, matching the Production budget-line pattern.
- Event-generated Budget rows remain read-only in Budget and should be updated from the Event record.
- Event and event-budget delete actions use protected confirmation flows and mobile-safe layout.
- Marketing campaign details now include a repeatable campaign-level Budget section that generates Budget rows for campaign-related income/spend.
- Opening an active Marketing campaign scrolls to the current campaign day.
- Marketing campaign budget delete controls were aligned and verified on desktop/mobile.
- Visible app label bumped to `Beta 1.5`.

Implementation prepared:
- Added private-by-default Supabase migration `202607140001_create_events_tracker.sql` for `event_locations`, `events`, and `event_budget_lines`.
- Added server route `/api/events` for loading and saving Events data with the Supabase service role.
- App now loads Events/Locations from `/api/events`, seeds Supabase from current local data when the remote Events tables are empty, and debounces snapshot saves after local edits.
- Events tables intentionally do not expose anonymous Supabase read policies because location contacts, notes, and event money are private app data.

Beta 1.5 release checklist:
- Supabase migration `202607140001_create_events_tracker.sql` applied successfully after retrying `supabase db push`.
- Smoke-test Events tab on local desktop and mobile widths.
- Smoke-test deployed app with Basic Auth after Vercel release.
- Commit/push and deploy through Vercel.

## Beta 1.6

Status: Release candidate prepared locally

Release theme:

Fully functional Budget module plus post-Beta 1.5 fixes and small cross-module refinements.

Core scope:
- Budget now has a server-side API route and Supabase-backed tables for editable manual ledger rows.
- Manual Budget rows can sync across devices through Supabase instead of staying only in browser local storage.
- Generated Budget rows from Events, Production, Marketing, and recurring plans remain derived/read-only where appropriate, avoiding duplicate stored financial records.
- Hidden/deleted generated Budget rows are persisted as generated-row preferences so intentional cleanup survives refresh and cross-device use.
- Budget summary cards keep the existing actual-versus-projected logic: historical income/spend/current balance through today, projected income/spend/balance one month ahead.
- SUNO is preserved as a monthly recurring payment through 04/04/2027 in the shared Budget data.
- Added the first Budget source-bucket analysis layer for Events, Production, and Marketing, with three since-start bucket cards and three one-month-forward bucket cards.
- Added a bucket selector for manual Budget rows and automatic bucket assignment for generated Events, Production, Marketing, and recurring rows.
- Tightened Budget ledger source-of-truth rules: Events/Marketing/Production generated rows are no longer editable or deletable from Budget, while recurring forecast rows and manual Budget rows keep Budget-side controls.
- Added Budget ledger sorting by Date, Bucket, Description, Amount, and Type, with one active sort at a time.
- Moved deeper Budget analytics behind a `More analytics` dropdown with first placeholder graph visuals for future cashflow and bucket-mix charts.
- Polished Budget amount display and inputs: expense cards show minus signs, production/marketing/event amount fields support comma formatting, and ledger columns were tightened for better description space.

Backlog already identified for Beta 1.6:
- Address Book new-location persistence was fixed so newly created locations can survive refresh and appear in the new-event dropdown.
- Marketing mobile UX follow-up from Yuliia: when adding a new task inside a campaign day and typing the task name, the screen can jump slightly up/down; revisit after the Budget module work is complete.

Storytelling angle:
- Beta 1.6 should be framed as the app learning money properly: not only tracking tasks and events, but turning income, expenses, recurring payments, and module-generated costs into a shared financial picture.

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

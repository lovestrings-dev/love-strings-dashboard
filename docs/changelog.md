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

Status: Released to production and verified; one post-release Budget follow-up identified for the next beta.

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

Post-Beta 1.6 follow-ups:
- Address Book new-location persistence was fixed so newly created locations can survive refresh and appear in the new-event dropdown.
- Budget follow-up discovered after release: a newly added manual ledger row survived refresh, but its Budget-side delete action did not remove it afterward; leave the fix for the next beta rather than patching Beta 1.6.
- Marketing mobile UX follow-up from Yuliia: when adding a new task inside a campaign day and typing the task name, the screen can jump slightly up/down; revisit after the Budget module work is complete.

Storytelling angle:
- Beta 1.6 should be framed as the app learning money properly: not only tracking tasks and events, but turning income, expenses, recurring payments, and module-generated costs into a shared financial picture.

## Beta 1.7

Status: Released to production and verified after GitHub push/Vercel deploy.

Release theme:

Platform analytics, Focus Queue improvements, and the practical follow-up fixes discovered after Beta 1.6.

Already added locally since Beta 1.6:
- Fixed the post-release manual Budget ledger delete bug.
- Split the Budget ledger into visible upcoming rows and a hidden-by-default historical section behind `See more`.
- Added first real Budget analytics graphs: Cashflow Evolution and Income vs Spend.
- Started a shared visual language for line graphs: clean grid, thick line, compact points, small legend boxes, first/middle/latest labels, and bottom date labels.
- Applied the improved graph language to Platforms graphs for YouTube, Instagram, YouTube Music, and Apple Music.
- Added color-coded graph metrics:
  - Instagram Followers: green.
  - Instagram Accounts reached: amber.
  - Instagram Views: blue.
  - YouTube Subscribers: green.
  - YouTube Lifetime Views: blue.
  - YouTube Music Subscribers: green.
  - YouTube Music Total Plays: blue.
  - Apple Music Total Plays: blue.
- Added YouTube `Lifetime Views` from the current YouTube Data API channel statistics and placed it as the second YouTube metric card after Subscribers.
- Recalculated YouTube lifetime-view history in Supabase using the current API lifetime total plus real YouTube Studio daily view deltas, and removed earlier invented history rows.
- Added small daily-change indicators to platform cards:
  - Instagram Followers, Accounts reached, and Views.
  - YouTube Subscribers and Lifetime Views.
  - YouTube Music Subscribers and Total Plays.
  - Apple Music Total Plays and Total Shazams, using latest CSV snapshot versus previous available snapshot.
- Moved manual metric Refresh from Dashboard to Platforms because the Vercel scheduler is now the main path and manual refresh is mostly a platform-data action.
- Added `Irrelevant` as a Marketing upload-task status for IG Upload and YT Upload, excluded from campaign completion and unfinished-task logic.
- Refined Focus Queue mobile layout so category/status becomes a compact header and task text gets the full remaining width.
- Focus Queue action now opens a compact status menu for source-linked Marketing and Production tasks.
- Focus Queue now owns local `Other` tasks without creating a separate app tab.
- Collapsed Focus Queue shows one Marketing reminder, one Production reminder, and up to three active Other tasks.
- Expanded Focus Queue shows only active Other tasks that are not already visible in the header, plus a hidden history section for Done/Irrelevant tasks.
- Other tasks can be added, edited, status-changed, archived via Done/Irrelevant, and temporarily deleted while the workflow is still being tested.
- Other task rows match the compact Focus Queue row style; `Edit` opens one row into an editable form with title, due date, status, notes, protected spacing, and autoscroll.
- Other tasks currently persist in local browser storage only; Supabase wiring is a future step before this becomes shared across Chrome, the internal browser, mobile, and Yuliia's device.
- Added a compact Benchmark production card to Dashboard, matching the Benchmark campaign idea: a target to beat, not just a previous record.
- Added today's Europe/Vienna date to the top header of every app module.
- Added poster-style image URL support for Events, including a tall poster preview and a persisted Supabase `poster_url` field.
- Refined Event poster UI so the poster thumbnail lives in the collapsed event header while the expanded details keep only the poster URL field.
- Tightened the Dashboard Budget preview cards and fixed module header date placement across Dashboard, Marketing, Platforms, Events, Budget, and Roadmap.
- Fixed Platforms header overflow on mobile after moving manual metric Refresh there.
- Verified Benchmark campaign still chooses the highest completion percentage, and Benchmark production counts duration from the next step when an existing demo is already done, or from Demo for newer songs without a completed demo.
- Confirmed all 27 current Production records have `Demo` as the earliest step by date.
- Visible app label bumped to `Beta 1.7`.

Deferred after Beta 1.7:
- Wire `Other` tasks to Supabase once the local workflow is confirmed.
- Investigate one rare Focus Queue edge case where repeated quick `Other task` add/edit actions may leave a newly created task in edit view unexpectedly.
- Dashboard mobile: use two-by-two Budget card layout while keeping four Budget cards in one desktop row.
- Dashboard Marketing preview: move current campaign completion percentage next to the title, matching Benchmark campaign, while keeping the progress strip below.
- Dashboard Marketing preview: tighten empty Next campaign whitespace on mobile and show current/next campaign cards as two columns on desktop.
- Marketing and Production module cards: expanded/collapsed arrow should point down when details are closed.
- Platforms: show two evolution graphs per row on desktop and keep single-column graphs on mobile.
- Roadmap work is likely the next larger module after this beta.

Post-deploy observations:
- Focus Queue worked as expected and survived browser refresh in production testing.
- Event poster links survived refresh; new poster links also saved and reloaded correctly.
- Budget ledger looked clean after the duplicate cleanup and is now close to an autopilot tracker for generated lines.
- Remaining work is mainly polish/backlog plus the planned Supabase wiring for `Other` tasks.

## Beta 1.8

Status: Release candidate verified locally; ready for GitHub/Vercel deployment.

Release theme:

Shared Focus Queue memory plus the practical Dashboard and Platforms polish collected after Beta 1.7.

Completed locally:
- Wired Focus Queue `Other` tasks to Supabase with server-side create, read, update, and delete support.
- Added Supabase-backed daily Focus scoring: 6-point target, Done = 2, In progress = 1, Not started = 0, Irrelevant excluded, and percentages allowed beyond 100%.
- Added compact daily score boxes and percentage to the Focus Queue header, with status changes captured from Focus Queue and directly from Marketing, Production, and Other-task editors.
- Successful Apple Music CSV import now completes one daily Focus task for 2 points; opening or dismissing the reminder does not score, and repeated same-day imports cannot create duplicate points.
- Added non-deletable release-day Marketing defaults for Update website, Facebook post, and YouTube post; they participate in completion, Focus Queue, daily scoring, and persistence without changing completed historical campaign benchmarks.
- Added a one-time local-to-Supabase merge so existing browser tasks are preserved instead of discarded during the move to shared storage.
- Added task-level debounced updates and retained local storage as an offline/failure fallback.
- Verified Other-task creation, editing, status changes, deletion, refresh survival, and cross-browser visibility.
- Confirmed the Dashboard Budget preview already uses four cards in one desktop row and a two-by-two mobile layout.
- Confirmed current campaign completion percentage is already positioned next to the campaign title for direct comparison with Benchmark campaign.
- Tightened the empty Next campaign card on mobile only.
- Kept Benchmark campaign full-width and placed Current and Next campaign cards side-by-side on desktop, matching the Production preview rhythm; smaller screens remain stacked.
- Standardized Marketing and Production card arrows: down when closed, up when expanded.
- Reflowed Platforms evolution graphs into two columns on desktop and one column on mobile.
- Shared QR records across devices through private Supabase storage and a protected server API, while retaining browser fallback and first-load migration.
- Removed anonymous Marketing write policies and moved campaign create/header/delete operations behind a protected server route.
- Made Marketing day/task replacement atomic so validation or database failure rolls back the entire save instead of leaving a partially reset campaign.
- Standardized module headers with the Vienna date in the top-right corner and kept `Love Strings Dashboard` on one line without reducing its display size.
- Fixed the Dashboard Next-event loading flash so the empty-state message is not shown before Supabase data finishes loading.

Known observation:
- A rare rapid-add Focus Queue sequence may leave a newly created Other task in edit view; it has not yet been reliably reproduced and does not block normal use.

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

## Beta 1.9 (Release Candidate)

Headline: **The Roadmap becomes a live planning module.**

- Replaced the static Roadmap prototype with Supabase-backed phases and Production-song phase assignments.
- Made release date the shared planning date across Production, Marketing, and Roadmap.
- Added bidirectional release-date persistence and collision-safe Marketing campaign-day shifting.
- Added live general and per-phase released/total counts, a dynamic phase-bounded month timeline, and release-status month colors.
- Added expandable all-song and phase-song lists with direct Production and Marketing status links.
- Added editable phase name, start/end month, and description settings.
- Added full-width `Create new phase` flow with automatic next-phase numbering; verified with Phase 4 `Go on tour`.
- Added responsive Roadmap refinements for dates, progress counts, expansion controls, and phase settings.
- Added a release-driven Production schedule: Demo remains independent, while Drums through Release are recalculated from the shared release date using the agreed 33-day production sequence.
- Kept Production deadline distinct from release date in Production cards by using the Distributor date as the operational deadline.
- Replaced the static Dashboard Roadmap preview with the live Phase 1 card, compact progress boxes, and an expandable song list.
- Included smaller backlog fixes and mobile/desktop UI polish collected after Beta 1.8.

Release checks:

- Shared date changes were tested from Production and Marketing and survived refresh in all linked modules.
- Production schedule recalculation was tested from a release-date change.
- Roadmap phase creation, reassignment, settings, and responsive layouts were user-tested.
- Lint and production build pass locally.

## Beta 1.10 (Release Candidate)

Headline: **The planning system becomes flexible enough for real daily work.**

- Completed the live Roadmap workflow: phase-backed month rows, song assignment, editable phase settings, expandable song lists, and linked release planning across Roadmap, Production, and Marketing.
- Added general Marketing campaigns for posts that do not belong to a song release, including independent start/end dates, artwork, optional progress, removable campaign days, and safe two-step deletion.
- Persisted Marketing campaign budget lines in Supabase so mobile and desktop use the same records and Budget receives one reliable source row.
- Reworked Marketing and Production cards around a mobile-first options pattern, protected release-date editing, clearer deadline summaries, and compact budget controls with reusable positive/negative amount toggles.
- Improved Budget source navigation and recurring-payment controls, treated a blank recurring end date as active until cancelled, opened newly created historical rows automatically, and removed false zero-value bars from Income vs Spend.
- Grouped the Roadmap month strip by phase, keeping every phase on its own visual row.
- Added precise platform update timestamps, corrected Apple Music current-release selection, made the module menu sticky, and prevented iPhone form-focus zoom without disabling normal pinch zoom.
- Refined Events empty states and archive dates, while preserving linked event posters and budget records.
- Excluded local video-production assets and an obsolete duplicate Vercel file from release commits.

Database changes:

- `202608050001_create_marketing_campaign_budget_lines.sql`
- `202608050002_add_general_marketing_campaigns.sql`
- `202608050003_add_marketing_progress_visibility.sql`

Release checks:

- User-tested campaign budgets across browsers and refreshes.
- User-tested general campaign creation, options, progress visibility, day/task deletion, and Focus Queue priority.
- User-tested recurring yearly generation without an end date and linked release-date behavior.
- TypeScript, lint, migration status, and production build are checked during final release preparation.

## Beta 1.11 (Release Candidate)

Headline: **Individual accounts arrive without splitting the shared Love Strings workspace.**

- Replaced the shared browser Basic Auth prompt with individual Supabase email/password accounts.
- Added invitation password setup, sign-in, sign-out, protected app routes, and authenticated Supabase reads.
- Added shared workspace membership plus personal dashboard-preference records as the foundation for future per-user card visibility, ordering, and dark mode.
- Kept all operational Marketing, Production, Events, Budget, Roadmap, Focus, and platform data shared between invited members.
- Changed Marketing campaign progress to reward `In progress` planning while excluding irrelevant work from the possible score.
- Refined Production steps with compact sections, collapsible budgets, optional instrument/license steps, and safer two-stage deletion.

Database changes:

- `202608060001_remove_edit_production_step.sql`
- `202608060002_add_multi_user_auth.sql`

Release checks:

- Dmitrii completed invitation onboarding, password setup, sign-out, sign-in, refresh, and shared-data access locally.
- Yuliia remains uninvited until the authenticated production build is deployed.
- TypeScript, lint, and production build are checked during final release preparation.

## Beta 1.12 (Release Candidate)

Headline: **Individual accounts begin to feel individual.**

- Added a compact avatar-triggered account menu with User settings, General Settings, About Dashboard, and Sign out.
- Added an in-app User settings canvas that remembers and returns to the module from which it was opened.
- Added editable per-user display names plus read-only email and workspace-role fields.
- Added private Supabase avatar storage with user-owned upload/delete policies, browser-side square resizing, immediate header updates, and replacement cleanup.
- Added the personal `Hi, [Name]` greeting to the app header and moved sign-out into the account menu.
- Prepared Yuliia's invited member profile with her display name and private avatar before first login.

Database changes:

- `202608060003_add_profile_avatars.sql`

Release checks:

- Supabase avatar migration applied successfully to the shared project.
- Yuliia's invitation, profile, avatar record, and workspace membership were read back successfully.
- User settings return navigation was checked from Dashboard and Production.
- TypeScript, lint, and production build are checked during final release preparation.

## Beta 1.13 (Release Candidate)

Headline: **The shared workspace gains real roles and shared identity controls.**

- Added Owner, Member, and Viewer workspace roles.
- Assigned Dmitrii as Owner and Yuliia as Member; future invited accounts default to Viewer.
- Restricted General Settings and shared branding changes to Owners.
- Added read-only Viewer mode for safe hands-on access to the shared Dashboard and modules.
- Added About Dashboard and General Settings canvases, moved the beta label and legal terms into About, and added private shared-logo management.
- Added an Owner-only invitation form to General Settings with email, role selection, and production-safe onboarding links.
- Added the first Owner-only Google services hub: one Google account can independently connect YouTube and the `www.lovestrings.at` Google Analytics property.
- Stored Google offline access as an encrypted, service-role-only Supabase record so OAuth credentials never reach browser clients.
- Added automatic Google access-token refresh and the first live `www.LoveStrings.at` Analytics collector.
- Added a Website Analytics card in Platforms with rolling 30-day active users, sessions, page views, top traffic source, daily Supabase snapshots, and evolution-graph history.
- Completed the flexible general-campaign day controls with an `Add campaign day` action that appends the next date, extends the campaign end, preserves deleted gaps, and persists through the existing campaign-day save flow.

Database changes:

- `202608060004_add_workspace_branding.sql`
- `202608060005_add_viewer_role_permissions.sql`
- `202608060006_add_google_connections.sql`

Release checks:

- Shared branding migration and role migration applied successfully.
- Supabase readback confirms `dimasounder@gmail.com` is Owner and `yuliiakostyts@gmail.com` is Member.
- Owner account menu exposes General Settings locally.
- Google connection migration applied; TypeScript and lint checks pass before OAuth consent testing.
- Live Analytics refresh returned 22 active users, 39 sessions, 43 page views, and Direct as the top source; all values survived app reload from Supabase.
- Confirmed Google Analytics uses the same daily cron, app-open fallback, and manual Platforms refresh path as the existing collectors.
- Verified the general-campaign add-day control after the full day list at desktop and 390px mobile widths.
- TypeScript, lint, and the Next.js 16.2.9 production build pass locally.

## Beta 1.14 (Release Candidate)

Headline: **One shared dashboard can now safely serve independent workspaces.**

Includes:

- Established Love Strings as the flagship/reference workspace, not a separate application fork: all workspaces share the same application code, UI, backend, and schema.
- Added the workspace `admin` role. Owners retain all Admin capabilities and future platform-level responsibilities; Admins manage their own workspace's members/viewers, integrations, and branding; Members operate normal workspace data; Viewers remain read-only.
- Moved branding to workspace UUID storage namespaces and permitted Owner/Admin branding management only within their active workspace.
- Replaced implicit Love Strings enrolment with server-validated, invitation-only workspace membership. Invitation acceptance is workspace-bound and idempotent, so a user can join several independently invited workspaces without affecting another membership.
- Added server-only, platform-operator-restricted workspace provisioning. New workspaces receive only their workspace record, settings, initial Owner membership, and dashboard preference; no Love Strings operational, analytics, integration, CRM, or branding data is copied.
- Created the first real second workspace, `Test Band`, and verified it has its own ID/settings and no operational data.
- Added the membership-derived workspace selector and server-validated HTTP-only `ls_active_workspace` cookie. Switching hard-reloads the client boundary to discard prior workspace state.
- Removed authenticated Love Strings workspace fallback. A valid selected membership is retained; missing/invalid selection resolves deterministically from the user's memberships; users with no memberships see a dedicated no-workspace state.
- Made Dashboard, Marketing, Production, Platforms, Events, Budget, Focus, Roadmap, General Settings/branding, manual metrics, and Google connection routes resolve the selected workspace consistently.
- Replaced browser-local operational-data hydration with server-scoped state so an empty workspace cannot revive stale Love Strings records.
- Completed two-workspace isolation QA. It found one visible defect: an empty Test Band could show Love Strings' default Roadmap Phase 1. The fallback was removed and empty Roadmap now renders its own empty state.

Google/OAuth security position:

- Google sign-in remains separate from Google service connection; normal sign-in does not grant Gmail, Drive, YouTube, or Analytics content access.
- Connected Google refresh grants remain encrypted server-side and are not returned through normal browser APIs. Connection records are workspace-owned and connection management is Owner/Admin scoped.
- The existing Google Analytics property preference and scheduled collector are still Love Strings-specific; workspace-specific Analytics/YouTube collection is deliberately deferred.

Database changes:

- `202608060008_add_workspace_ownership_foundation.sql` through `202608060012_segregate_platform_analytics.sql`
- `202608070001_add_workspace_admin_role.sql` through `202608070005_restrict_workspace_provisioning_function.sql`

Release checks:

- Remote migration history is synchronized through `202608070005`.
- Test Band database readback confirms zero Production, Marketing, Events, Budget, Focus, Roadmap, analytics/account, and QR operational rows.
- Workspace-scoped service routes, upserts, replacement functions, and delete paths were audited.
- Lint, TypeScript, Next.js production build, and `git diff --check` pass.

Not included in Beta 1.14:

- Deployed authenticated smoke testing and external Test Band onboarding.
- Invitation management UI, platform-owner workspace monitoring, and multi-workspace scheduled metrics refresh.
- Workspace-specific Google Analytics property selection and YouTube collector redesign.
- Gmail/CRM, Spotify, Deezer, and Amazon integrations.

## Beta 1.15 (Release Candidate)

Headline: **Workspace access is now manageable through a safe Admin lifecycle.**

Includes:

- Simplified workspace roles to Admin, Member, and Viewer. Existing workspace
  Owner memberships and pending Owner invitations were migrated to Admin; the
  platform-level `app_platform_operators` registry remains separate.
- Made Admin the complete workspace-administration role for settings, branding,
  integrations, invitations, and normal operational editing, without granting
  workspace creation or platform access.
- Added active-workspace Admin member management: safe member listing, role
  changes between Admin/Member/Viewer, and workspace-scoped member removal.
- Added a database trigger that prevents a workspace from losing its final
  Admin, including concurrent demotion/removal attempts.
- Added invitation lifecycle visibility and management: pending, accepted,
  expired, and revoked states; pending-role changes; resend with secure token
  rotation; and revocation without deleting any account or membership.
- Hardened invitation acceptance so it atomically checks recipient, expiry,
  revocation, and acceptance state before creating membership and selecting the
  new workspace.
- Fixed the real first-invitation handoff: a browser-established Supabase
  session is verified through a same-origin bearer token when a matching server
  auth cookie is not yet available.
- Fixed the first-membership ordering fault found in production onboarding:
  invitation acceptance now bypasses the membership-enforcing proxy only to
  reach its own authenticated route, which atomically creates the membership
  and marks the invitation accepted before setting the active-workspace cookie.
- Made invitation resend visibly single-flight, with an in-row loading state,
  a newest-link confirmation, and a useful failure message.
- Fixed a first-load `/set-password` race: the page now waits for Supabase's
  browser session initialization before falling back to manual link handling,
  so an in-flight invitation sign-in is not incorrectly shown as unverified.
- Included the multi-workspace QA fixes already in the unreleased batch,
  including safe empty-workspace behavior and platform/workspace separation.

Database changes:

- `202608080001_normalize_workspace_roles.sql`
- `202608080002_remove_legacy_workspace_owner_helper.sql`
- `202608080003_enforce_workspace_admin_membership_invariant.sql`
- `202608080004_add_workspace_invitation_lifecycle.sql`
- `202608080005_make_workspace_invitation_acceptance_atomic.sql`
- `202608080006_fix_workspace_invitation_acceptance_function.sql`

Release checks:

- Linked migrations are synchronized through `202608080006`.
- Rollback-only database tests covered Admin-role safety, workspace-scoped
  removal, invitation rotation/revocation/expiry behavior, and no persistent
  test rows.
- Lint, TypeScript, production build, database lint, and `git diff --check`
  pass locally.

Still deferred:

- Deployed authenticated invitation acceptance smoke testing; resend the
  existing Test Band Admin invitation only after this release is deployed.
- Multi-workspace scheduled metrics refresh, workspace-specific Analytics/
  YouTube collection, Gmail/CRM, Spotify, Deezer, Amazon, and workspace
  archive/delete workflows.

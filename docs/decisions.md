# Decisions

## 2026-06-28 - Initial Hosting Direction

Decision:

- Use Vercel free tier as the initial hosting target.
- Use Next.js / React as the likely first app stack.

Reason:

- The project is currently in prototype/learning mode.
- Vercel is free to start and beginner-friendly.
- It is a strong fit for responsive dashboard apps.
- It gives the project portfolio value beyond the Love Strings use case.

## 2026-06-28 - Database Direction

Decision:

- Build an own database early.
- Use Supabase free tier / PostgreSQL as the initial database target.
- Treat Excel and Google Sheets as import/bootstrap sources only.
- Store selected daily metrics from external platforms in our own database.
- Dashboard should read from the database, not directly from every source platform.

Reason:

- The project needs historical business development, not just current platform numbers.
- Platform dashboards are source systems, not a reliable long-term business memory.
- Supabase gives a real PostgreSQL database, hosted free tier, auth later, and a good admin UI.
- This architecture supports future AI agents and professional business-app credibility.

## 2026-06-28 - Portfolio/Professional Framing

Decision:

- Build the dashboard first for the real Love Strings hobby business.
- Design and document it cleanly enough to demonstrate business/product thinking for larger corporate use cases.

Reason:

- The same dashboard concepts transfer to corporate contexts: roadmap, sprints, budget vs revenue, marketing execution, KPIs, drill-down analytics, and automation.
- A real small-business case is more credible than a generic demo.

## 2026-06-28 - Project Accounts Context

Known project account context:

- GitHub account: `lovestrings-dev`
- Supabase project/account context: `lovestrings-dev's Project`
- Project email / Google account: `lovestringsband@gmail.com`

Note:

- This file should store account identifiers only, not passwords, API keys, tokens, recovery codes, or database secrets.

## 2026-06-29 - Dashboard Navigation And Platform Metrics

Decision:

- Treat Dashboard as the daily command screen, not as the Production tab.
- Keep Marketing and Production as separate top-level sections.
- Hide Sprints from top-level navigation for now, while keeping sprint tables and sprint thinking available for later use.
- Move Strategic Roadmap content out of Dashboard and into the Roadmap section.
- Use Dashboard for the most important platform snapshot only.
- Use Platforms for the full platform statistics view.

Current Dashboard platform cards:

- Instagram
- YouTube Channel
- Spotify
- YouTube Music
- Apple Music

Current Platforms section cards:

- Instagram
- YouTube Channel
- Spotify
- YouTube Music
- Apple Music
- Amazon Music
- Deezer
- New Platform placeholder

Reason:

- Dashboard should stay focused on the most actionable daily signals.
- Platforms can hold the broader analytics surface without crowding the daily view.
- Sprints may become useful later inside Marketing or Production rather than as a separate top-level page.
- The database should model real entities and metrics, not mirror menu labels exactly.

## 2026-07-01 - Marketing Campaign UI Before Campaign Backend

Decision:

- Prototype Marketing campaign workflows locally in the UI before designing final Supabase campaign tables.
- Keep a local/browser fallback, but use Supabase campaign records as the primary shared source when available.
- Store the durable campaign schema and first seed data in Supabase so Marketing and Production can share release/campaign concepts.
- Show Dashboard campaign previews from the same shared campaign state used by Marketing.

Current local campaign UI:

- Multiple campaign boards sorted by saved release date, newest/latest first.
- Seeded campaigns: `Rock and Roll`, `Flowers`, `Jukebox`, `Wonderful Life`, and `Intro`.
- `Long Time` was removed from seeded campaigns because it was a demo name for `Rock and Roll`.
- Campaigns use a 14-day default window starting 4 days before release.
- Campaign header supports editable campaign title, editable release date, direct album-art URL, next open tasks, progress strip, and collapsible daily details.
- New campaigns can be added locally.
- Campaigns can be deleted locally only through a protected details flow: expand the campaign, open `Campaign options`, tick the confirmation checkbox, then press `Delete campaign`.
- Direct Cloudinary delivery URLs are acceptable for album art while the app stays on free infrastructure.

Reason:

- The Marketing UI has stabilized enough to create durable campaign tables.
- Supabase now has `marketing_campaigns`, `marketing_campaign_days`, and `marketing_campaign_tasks` from migration `202607010001_create_marketing_campaigns.sql`.
- Temporary anonymous prototype writes exist only for these Marketing campaign tables and should be replaced with authenticated policies before public launch.
- Marketing and Dashboard now load campaigns from Supabase when available.
- Campaign title/date changes, campaign deletion, new campaigns, and full day/task plan snapshots write back to Supabase through temporary prototype policies.
- The next sharing step is basic app access protection plus Vercel deployment.

## 2026-07-06 - Platform API Snapshots And Refresh Rules

Decision:

- YouTube and Instagram are the first working platform API collectors.
- Keep one metric snapshot per platform/account/content/metric/source per calendar date.
- A manual refresh updates today's rows instead of creating unlimited extra rows.
- Normal app open/refresh should only read the latest data already stored in Supabase.
- Do not automatically run API collectors every time the app opens.
- Keep a visible/manual Dashboard `Refresh` action for intentional fresh pulls.
- Use the 01:00 Europe/Vienna hour as the daily scheduled snapshot target, so data should usually be fresh before morning app use.
- Use GitHub Actions for the production scheduler because it can send the required `Authorization: Bearer CRON_SECRET` header to the protected endpoint.
- Give GitHub Actions several chances during the target hour because scheduled workflows can be delayed or occasionally skipped.

Current working API metrics:

- YouTube Channel subscribers.
- YouTube latest regular video title and views.
- YouTube latest Short title and views.
- YouTube Music Topic channel subscribers.
- YouTube Music total plays from Topic channel views.
- YouTube Music current release plays from the latest Topic channel track.
- Spotify artist followers.
- Spotify artist popularity score for later analytics.
- Instagram followers.
- Instagram accounts reached in the last 30 days.
- Instagram views in the last 30 days.
- Instagram latest Reel/Post title and views.

Reason:

- One row per metric per day keeps Supabase small and predictable.
- Manual refresh is useful during active campaign checks, but should not pollute the daily timeline with duplicate rows.
- Opening the app should stay fast and should not unexpectedly consume API quota.
- If historical charts later need a strict 06:00 archive plus live/manual data, split sources into `daily_snapshot` and `latest_live` or `manual_refresh`.

Implementation notes:

- Local CLI importers still exist for direct testing: `pnpm run import:youtube`, `pnpm run check:instagram`, and `pnpm run import:instagram`.
- A server-side refresh endpoint exists at `/api/metrics/refresh` for the Dashboard refresh button and future scheduler.
- Server refresh requires `SUPABASE_SERVICE_ROLE_KEY` because it writes metric snapshots with service-role privileges.
- The scheduler calls `https://love-strings-dashboard.vercel.app/api/metrics/refresh?scheduled=1` at `23:05/23:20/23:35/23:50 UTC` for daylight saving time and `00:05/00:20/00:35/00:50 UTC` for standard time.
- The endpoint no longer skips delayed scheduled calls based on the current hour. If GitHub Actions runs late, the app still collects a daily snapshot.
- Metric snapshots use the Europe/Vienna calendar date, not the UTC date, so 01:00 Vienna in summer still writes the intended local-day snapshot.
- Repeated calls during the same Vienna day update the same daily metric rows because `platform_metric_snapshots` has a daily uniqueness rule. This avoids duplicate daily snapshots while making the GitHub schedule more resilient.
- YouTube Music first uses the public Topic channel ID `UCKlfg9lYKyMOg_Oiz-Zb1Fg` with the existing YouTube Data API key. OAuth-based YouTube Analytics may be revisited later if we need deeper artist-only metrics.
- Spotify first uses artist ID `4CESELwcVlIPnfiWuaxRbF` with the Spotify Web API Client Credentials flow. Exact Spotify stream counts remain manual/export-based until a Spotify for Artists data path is found.

## 2026-07-06 - Apple Music CSV Snapshot Model

Decision:

- Use browser CSV upload for Apple Music for Artists data instead of trying to automate an unavailable artist analytics API.
- Parse Apple Music CSV files once, write extracted metrics to Supabase, and discard the original file content.
- Store all available CSV metrics per song: plays, average daily listeners, Shazam count, radio spins, and purchases.
- Store dashboard aggregate metrics on the same report end date: last update, total plays, total Shazams, current release name, current release plays, and current release Shazams.
- Treat Apple CSV imports as lifetime report snapshots. Campaign growth should be calculated later as the difference between two lifetime snapshots, for example start-of-campaign versus end-of-campaign.

Reason:

- Apple Music for Artists data is not available to the app as a simple daily API collector.
- Lifetime snapshots prevent missing first/last campaign-day totals when CSV exports are only downloaded a few times per sprint.
- Supabase should store the useful structured data, not the raw CSV file, unless an audit/archive requirement appears later.

Verified result:

- The first Apple Music CSV upload/import test worked successfully in the deployed app.
- The raw CSV is not stored by the app; only parsed metrics are stored in Supabase.
- The Dashboard card can now be refined visually later without changing the agreed import model.

## 2026-07-08 - Dashboard As Cross-Module Command Screen

Decision:

- Dashboard should show compact copies of the most useful cards from other modules instead of forcing Dmitrii/Yuliia to open every tab each morning.
- Keep these Dashboard cards as summaries/drill-down previews, not separate data owners.
- Source-module tabs remain the place where deeper editing and full workflows live.

Current Dashboard summary sections:

- Next event at the top.
- Compact platform snapshot cards for Instagram, YouTube Channel, Spotify, YouTube Music, and Apple Music.
- Marketing previous/current/next campaign cards.
- Current and next Production song cards with progress and collapsible task lists.
- Budget current balance and upcoming balance.
- Roadmap Phase 1 progress card.

Reason:

- The Dashboard should feel like a daily command screen with enough context to decide what matters today.
- Cross-module copies reduce navigation friction while preserving one source of truth per module.
- Compact dashboard cards are intentionally denser than the full module views.

Implementation notes:

- Dashboard platform cards use compact styling only on Dashboard; the Platforms tab keeps fuller analytics cards.
- Dashboard Production cards show up to 3 next unfinished tasks by default and can expand to the full song task list, then collapse back to compact view.
- The Roadmap Phase 1 card is currently a UI copy of seeded roadmap phase data; later it should read live release/production/marketing status.

## 2026-07-08 - Apple Music Import Belongs In Platforms

Decision:

- Move the Apple Music CSV import control out of Dashboard and into the Apple Music card on the Platforms tab.
- Keep Apple Music CSV upload as a platform-specific maintenance action, not a daily command-screen action.
- Clean the Apple Music card so it shows only decision-useful metrics:
  - Last Update on one compact line.
  - Total Plays.
  - Total Shazams.
  - Current Release Plays with release name as context.
  - Current Release Shazams with release name as context.

Reason:

- Dashboard should show the result of platform data collection, not all import/admin controls.
- Apple Music import is manual and occasional, so it belongs near platform details.
- Removing duplicate date/release/file-name text keeps the card readable on mobile.

## 2026-07-14 - Beta 1.5 Events Persistence Direction

Decision:

- Make Events the next module to become fully Supabase-backed.
- Keep the Events tab as the source of truth for show/event details, location details, and event-specific income/spend.
- Keep generated Budget rows from Events read-only in the Budget tab.
- Update event-generated Budget values by editing the source Event, not by editing the generated Budget row.
- Add a Location Address Book as a real supporting entity for Events instead of repeating the same venue/contact information in every event.
- Reuse the same protected delete and repeatable budget-line patterns across Events, Marketing, Production, and Budget.

Current local Events model:

- Events can be added, edited, and deleted locally.
- Each event has date, name/link, location name/link, address/link.
- Each event can contain repeatable budget lines with reason and positive/negative amount.
- Budget rows generated from Events use the event as the source and are deletable in Budget only as hidden/generated rows.
- Location Address Book records include venue name/link, address/link, contact name, contact phone, contact notes, and event history for that location.
- New event location name is a dropdown from the Address Book and autofills related links/address fields.

Reason:

- Events are a natural next persistence target because they now affect both Dashboard and Budget.
- Yuliia and Dmitrii should see the same show archive, upcoming events, venue contacts, and event-related money records.
- Wiring Events before Budget reduces confusion because Budget can then rely on a stable event source instead of local-only generated rows.

Beta 1.5 open implementation notes:

- Prefer the Production-module persistence style: server-side writes using Supabase service role where broad browser write policies are not needed.
- Events tables are private-by-default with no anonymous Supabase read policies; the app reads and writes through `/api/events` behind the existing app access protection.
- Marketing campaign budget lines are included in the app/Budget logic locally, but can be held for a later Marketing/Budget persistence pass if Beta 1.5 should stay focused on Events.
- Preserve localStorage fallback during migration so current local event data is not lost if Supabase is temporarily unavailable.

## 2026-07-08 - Events Tab And Upcoming Event Logic

Decision:

- Add an Events tab for historical and future Love Strings shows/appearances.
- Seed historical events from `https://www.lovestrings.at/news`.
- Allow manual add/edit for event date, event name/link, location name/link, and address/link.
- Show the Events summary as:
  - `Next event`, based only on future dates.
  - `Total events`.
- If every event is in the past, show `No upcoming events planned yet`.
- Display weekday in the event date and show days left before the event.

Reason:

- Live shows affect budget, audience growth, content opportunities, and production/marketing priorities.
- The next event is more actionable than the latest archived event.
- Manual event entry is enough for the current internal beta; backend persistence can come later.

## 2026-07-09 - Budget Actuals Versus Projections

Decision:

- Budget summary cards should separate historical actuals from future projected money.
- `Total earned`, `Total spent`, and `Current Balance` include only entries dated up to and including today.
- `Projected earn` and `Projected spend` include entries dated from tomorrow through one month ahead.
- `Projected balance` equals current balance plus projected earn minus projected spend.
- Dashboard Budget preview should show four compact cards in this order:
  - Current balance.
  - Projected earn.
  - Projected spend.
  - Projected balance.

Reason:

- The first row answers "where are we now?" and should not be distorted by future planned income/spend.
- The projected row answers "what happens soon?" and is useful for planning the next month.
- Putting the four Dashboard budget cards in one row makes the command screen more compact without hiding the money picture.

## 2026-07-09 - Events Can Generate Budget Lines

Decision:

- Event cards can store earned/spent values plus optional descriptions.
- Filled event money fields generate read-only one-off Budget ledger rows.
- The event remains the source of truth for those generated rows; to change the amount or reason, edit the Event, not the Budget row.
- Generated event Budget rows remain safely deletable from the Budget ledger.
- Default generated descriptions use the event name plus `earned` or `spent`; manually entered reasons are shown after the event name.

Reason:

- Gig income and gig expenses belong naturally to Events, but they must affect Budget totals.
- Keeping generated Budget rows read-only prevents conflicting edits in two places.
- Showing the event name in the Budget description preserves traceability when reviewing the ledger later.

## 2026-07-09 - Production Can Generate Budget Lines

Decision:

- Production steps can store earned/spent budget rows.
- Standard production costs can be prefilled on repeated steps:
  - `License`: EUR 20 spend.
  - `Distributor`: EUR 10 spend.
- Production-generated Budget rows are generated from the Production plan rather than manually re-entered in Budget.
- Budget should only show generated future Production rows within the next one-month planning window, so long-range production plans do not distort the near-term money view.
- Generated Production Budget rows are informational in the Budget ledger and should be edited from the Production step where they originated.

Reason:

- Production decisions directly create real costs.
- Re-entering license/distributor expenses for every song is repetitive and error-prone.
- The Budget tab should help with near-term planning, not overwhelm the user with every planned cost many months ahead.

## 2026-07-15 - Budget Persistence Model

Decision:

- Persist editable manual Budget ledger rows in dedicated Supabase tables through a server-side `/api/budget` route.
- Keep generated Budget rows from Events, Production, Marketing, and recurring plans derived from their source modules instead of storing them as duplicate manual ledger rows.
- Persist hidden/deleted generated-row IDs as user cleanup preferences.
- Keep browser local storage as a fallback, but use Supabase as the shared Budget source once available.

Reason:

- Budget contains sensitive money data, so direct browser writes to Supabase should be avoided.
- Generated rows should stay traceable to the source module that created them.
- Avoiding duplicate generated records keeps Supabase lighter and reduces future reconciliation problems.
- Persisting hidden generated rows lets the Budget view remain tidy across refresh and devices.

## 2026-07-15 - Budget Source Buckets

Decision:

- Add a future Budget analysis layer based on source buckets:
  - `Events`
  - `Production`
  - `Marketing`
- Generated Budget rows should inherit their bucket from the module that created them.
- Manual one-off and recurring Budget rows should get a bucket selector, because recurring tools can belong to different business areas.
- Marketing bucket should include campaign budget lines, marketing-related event spends, and manual marketing rows such as Canva.
- Production bucket should include Production module costs and manual production rows such as SUNO or other production tools.
- Events bucket should include event income and event expenses, excluding event spends that are explicitly marketing-related.
- Budget should later add six bucket summary cards:
  - Events total since start
  - Production total since start
  - Marketing total since start
  - Events projected one month ahead
  - Production projected one month ahead
  - Marketing projected one month ahead

Reason:

- Overall Budget answers "Are we positive or negative?"
- Bucket analysis answers "Which part of the music project creates or consumes the money?"
- Independent musicians need to see whether shows, releases, and promotion are each moving in a healthy direction.
- Adding bucket metadata now keeps later charts and decisions from relying on fragile description parsing.

## 2026-07-15 - Budget Ledger Source Of Truth

Decision:

- Budget ledger rows generated from Events, Marketing campaigns, and Production plans are read-only in the Budget ledger.
- Those source-module rows cannot be hidden or deleted from Budget; to remove or correct them, edit/delete the budget record in the source module.
- Recurring-payment forecast rows remain hideable/deletable from Budget because they represent expected future payments that may stop before the parent recurring plan is edited.
- Manual Budget rows remain editable/deletable directly in Budget.

Reason:

- Events, Marketing, and Production are the source of truth for their own financial records.
- Hiding source-generated rows inside Budget can create silent gaps in analytical cards and make totals look cleaner than reality.
- Recurring forecasts are different: they are projections, so deleting a future forecast row can reflect that a planned payment will not actually happen.

## 2026-07-10 - Production Owns Release Identity For Marketing

Decision:

- Production is the source of truth for song names used by Marketing.
- New Marketing campaigns are created by choosing a song from the Production song dropdown.
- Existing Marketing campaign title editing also uses the Production song dropdown rather than free text.
- Marketing and Dashboard campaign cards display the matching Production song name when a match is available.
- Production also owns album-art external URLs. Marketing displays the matching Production artwork, or a generic `Album art pending` placeholder when no Production artwork URL exists.

Reason:

- The song is born in Production before it becomes a Marketing campaign.
- Keeping names and artwork in Production reduces duplicate fields and avoids small mismatches between modules.
- This is a first step toward a proper shared song/release id. For now, title matching is acceptable for the internal prototype, but the backend should later use stable ids.

## 2026-07-14 - Metrics Refresh Reliability

Decision:

- Move the primary daily platform metrics scheduler from GitHub Actions to Vercel Cron.
- Keep the old GitHub Actions workflow as a manual fallback only by removing its scheduled triggers.
- Schedule Vercel Cron at `05:00 UTC`, which targets the morning in Vienna: about 07:00 during daylight saving time and 06:00 during standard time.
- Add an app-open safety check: when the app opens, it reads Supabase first and triggers one refresh only if today's Europe/Vienna snapshot is missing.
- Keep the manual Dashboard Refresh button for intentional fresh pulls during active checks.
- Keep the Vercel Cron endpoint narrow and quiet: it accepts only the expected Vercel cron schedule headers and returns collector counts rather than detailed metric data.

Reason:

- GitHub scheduled workflows proved unreliable for this project, with several expected overnight runs delayed or skipped.
- Vercel Cron lives next to the deployed app and should be easier to observe in Vercel logs.
- The app-open check gives Dmitrii and Yuliia a practical self-healing fallback: if the scheduled run misses, opening the app can still create today's snapshot.
- Same-day Supabase upsert rules still prevent duplicate daily snapshot rows.

Verification:

- On 2026-07-15, Supabase contained fresh platform metric snapshots for the Europe/Vienna date `2026-07-15`.
- Rows were imported around `2026-07-15T05:04:06-08Z`, which is about 07:04 in Vienna during daylight saving time.
- The successful automated snapshot included Instagram, YouTube Channel, and YouTube Music metrics, confirming that the Vercel-based autopilot path worked.

## 2026-07-16 - Platform Graphs And Metric Naming

Decision:

- Use one shared visual language for compact line graphs across Budget and Platforms.
- Graphs should use a clean grid, thick colored line, compact points, small legend boxes in the graph title, and limited labels rather than labeling every data point.
- Platform graph colors should communicate the nature of the metric:
  - green for audience/followers/subscribers,
  - blue for consumption/views/plays,
  - amber for reach.
- Treat the YouTube Data API channel `viewCount` as `Lifetime Views`, not as current 28-day views.
- Keep YouTube Studio period views separate conceptually from YouTube API lifetime views.
- Historical YouTube Lifetime Views should use real daily deltas when available and be clearly backed by current API totals, not invented seed numbers.

Reason:

- The Platforms tab is becoming an analytics surface, so inconsistent graph styles quickly make it look like separate prototypes stitched together.
- The YouTube `viewCount` confusion showed that correct metric names are part of the data model, not just UI wording.
- Labeling `viewCount` as `Lifetime Views` prevents a false comparison with YouTube Studio's selected-period views.

## 2026-07-16 - Manual Refresh Belongs In Platforms

Decision:

- Move the manual metrics Refresh action from Dashboard to the Platforms tab.
- Dashboard should mostly show the current state, while Platforms owns data-refresh and deeper analytics behavior.
- Keep the scheduled Vercel Cron job as the normal daily update path.

Reason:

- The scheduler is now working, so manual refresh is less of a daily Dashboard action and more of an intentional platform-data maintenance action.
- This keeps the Dashboard calmer and reduces visual clutter in the command-center view.

## 2026-07-16 - Marketing Irrelevant Status

Decision:

- Add `Irrelevant` as a valid status for Marketing IG Upload and YT Upload tasks.
- Exclude `Irrelevant` tasks from campaign completion percentage calculations.
- Exclude `Irrelevant` tasks from unfinished-task lists and Focus Queue.
- Do not add `Irrelevant` to the production status model.

Reason:

- Some campaign videos/posts are intentionally not suitable for both platforms.
- Marking those tasks as Not started or In progress would make the campaign look less complete even when the plan is correct.
- This status lets the campaign calendar describe reality without punishing the progress score.

## 2026-07-16 - Focus Queue Status Control

Decision:

- Focus Queue can update source-linked Marketing and Production task statuses directly.
- Marketing Focus Queue tasks expose the Marketing status set, including `Irrelevant` where allowed.
- Production Focus Queue tasks expose Production statuses only.
- Other tasks show status UI for design continuity, but do not save yet because the Other-task storage model is not decided.

Reason:

- Focus Queue should become the quick action surface for today's work, not only a read-only list.
- Status changes must still respect the source module's rules so the Dashboard does not become a hidden second source of truth.
- Other tasks need a deliberate storage design before they become active records.

## 2026-07-16 - Focus Queue Owns Other Tasks

Decision:

- Do not create a separate app tab for miscellaneous `Other` tasks.
- Make Focus Queue the home for Other tasks because they are usually small, fast, near-term reminders or ideas.
- Collapsed Focus Queue should show:
  - one Marketing reminder,
  - one Production reminder,
  - up to three active Other tasks.
- Expanded Focus Queue should not repeat the full Marketing or Production task lists; those live in their own modules.
- Expanded Focus Queue should show only Other tasks that are not already visible in the header, plus a hidden completed/irrelevant history section.
- Other tasks can be `Not started`, `In progress`, `Done`, or `Irrelevant`.
- `Done` and `Irrelevant` are treated as history/archive states, not deletion.
- Keep delete available temporarily while testing, but the intended product direction is to preserve task history and avoid easy deletion.
- Persist Other tasks locally first while the UX is being tested; wire them to Supabase after the workflow stabilizes.

Reason:

- Other tasks are important enough to remember, but not structured enough to deserve a full module.
- Keeping them in Focus Queue turns the Dashboard into a practical daily action surface without adding navigation weight.
- Preserving completed/irrelevant tasks supports later storytelling and personal memory: ideas that seem irrelevant today may become useful later.
- Local-first implementation let us test interaction details quickly; shared Supabase persistence should come once the behavior is settled.

## 2026-07-16 - Beta 1.7 Release Boundary

Decision:

- Treat the current Beta 1.7 candidate as a day of practical polish: platform analytics, Budget graphs, Focus Queue usability, dashboard refinements, and small cross-module additions.
- Keep the new Other Tasks workflow local-only for this beta and wire it to Supabase in the next development session.
- Let Event poster URLs persist now, because Events already has a Supabase-backed module and a poster that disappears after refresh would be confusing.
- Add Benchmark production to Dashboard as a gamified target, matching the Benchmark campaign idea.
- Keep Benchmark campaign as the best-completion campaign target, not a simple previous-campaign card.
- Keep Benchmark production as a speed-to-produce target: count from the next production step when `Demo` is already done, otherwise count from `Demo`.

Reason:

- The Other Tasks interaction needed real UX testing before it became shared data for Dmitrii and Yuliia.
- Event poster support is a small database-safe extension to an already wired module, so it fits the beta polish scope.
- A beta release can carry many small quality-of-life wins as long as the one intentionally unfinished boundary is clearly named.
- The current production database was checked before release prep: all 27 current songs still have `Demo` as the earliest step by date, so the Benchmark production duration rule matches the real records.

Post-release validation:

- GitHub push and Vercel deploy completed successfully.
- Focus Queue persisted through browser refresh and is considered ready for Supabase wiring in the next session.
- Event poster URLs persisted through refresh, including newly added poster links.
- Budget ledger looked clean after generated-line cleanup and is close to the intended autopilot tracker behavior.
- Keep one rare Focus Queue add/edit oddity as a watch item, but do not block the release on it unless it becomes reproducible.

Next direction:

- Treat the next beta as `Other Tasks` persistence plus the Beta 1.7 polish backlog.
- Roadmap logic is the next larger module after that.
- UI graphics/skin work should be discussed before implementation; an old-school Winamp-inspired skin is a possible study case, not an immediate code task.

## 2026-07-19 - Daily Focus Score

Decision:

- Set a daily Focus Queue target of 6 points: three completed tasks.
- Score `Done` as 2 points, `In progress` as 1 point, `Not started` as 0, and exclude `Irrelevant`.
- Show at least three compact status boxes in the Focus Queue header; add boxes when more than three tasks are touched so the score can exceed 100%.
- Record one current status per stable task key and Vienna calendar day in Supabase. Repeated status changes update the same daily record instead of generating duplicate points.
- Count status changes made directly in Marketing, Production, and Other-task editors as well as changes made from Focus Queue.
- Count a successful Apple Music CSV import as one completed Other task for that day; opening or dismissing the reminder earns no points, and repeat imports update the same daily record.

Reason:

- The score rewards actual daily work rather than clicks inside one particular screen.
- Fixed daily records create a future source for consistency/evolution graphs without inflating history through repeated status toggles.
- This extends the app's `beat yourself` idea from campaign completion and production speed into everyday creative/admin momentum.

## 2026-07-19 - Release-Day Marketing Defaults

Decision:

- Add three non-deletable standard tasks to the release day: `Update website`, `Facebook post`, and `YouTube post`.
- Include them in campaign completion, unfinished-task lists, Focus Queue actions, daily Focus scoring, and Supabase campaign persistence.
- Apply the defaults to active and future campaigns, but do not retrofit completed historical campaigns and distort benchmark percentages.

Reason:

- Release day includes important announcement work beyond the recurring video/IG/YT upload routine.
- These actions are predictable enough to be standard tasks rather than manually recreated extras.

## 2026-07-19 - Atomic And Protected Marketing Writes

Decision:

- Remove temporary anonymous write policies from all Marketing campaign tables.
- Route campaign creation, header updates, and deletion through `/api/marketing/campaigns` using the server-held Supabase service role.
- Replace campaign days and tasks through one database transaction exposed by `/api/marketing/campaign-days`.
- Keep anonymous reads for the current dashboard experience, but do not expose direct browser writes.

Reason:

- A failed task insert previously had enough room to leave a campaign partially reset after its old days were deleted.
- Atomic replacement guarantees all-or-nothing behavior and makes validation failures recoverable without data loss.
- Server-side writes reduce the public mutation surface before the app grows beyond its current private beta audience.

## 2026-07-19 - Shared QR Records

Decision:

- Store editable QR records in the private `qr_links` Supabase table and mutate them only through `/api/qr-links`.
- Preserve local browser storage as an offline fallback and as the one-time source for seeding an empty shared QR list.
- Replace the whole ordered QR list atomically because it is a small configuration collection, not a high-volume ledger.

Reason:

- QR links are useful specifically when the app is opened on different phones and by both Dmitrii and Yuliia.
- Local-only QR configuration made each browser a separate source of truth.
- The collection is small enough that one protected snapshot is simpler and safer than many independent reorder/update calls.

## 2026-07-20 - Release Date Is The Shared Planning Date

Decision:

- Treat release date as the final Production step and the primary Roadmap achievement date.
- Production, Marketing, and Roadmap edit the same underlying planning fact rather than maintaining separate plan/fact dates.
- When the shared date changes, update the linked Marketing campaign release date and shift its campaign days by the same date delta.
- Use a collision-safe database operation so campaign-day dates can be shifted without violating the campaign/date uniqueness constraint.

Reason:

- The release is the outcome that matters most for the Love Strings catalog; a separate production-finished headline metric added complexity without improving planning.
- One shared date prevents the three modules from quietly disagreeing.
- Dmitrii tested updates from both Production and Marketing and confirmed all three views persist the same date after refresh.

Implemented scheduling rule captured 2026-07-21:

- Exclude `Demo` from release-date backward scheduling. A demo may exist for months or a year before full production begins.
- Treat `Drums` as the beginning of the release-driven production schedule.
- Intervals: Drums to Guitars 3 days; Guitars to Bass 1 day; Bass to Vocals 3 days; Vocals to Edit 3 days; Edit to Mix 5 days; Mix to Master 1 day; Master to License 1 day; License to Cover Art 1 day; Cover Art to Distributor 1 day; Distributor to Release 14 days.
- The complete release-driven schedule runs 33 calendar days from Drums to Release.
- Recalculate the release-driven Production steps whenever the shared release date changes; keep Demo unchanged.
- Use Distributor as the Production deadline because active production is effectively complete once delivery begins, while Release remains the shared Roadmap/Marketing achievement date.
- Review the Dashboard Production benchmark calculation against this new definition of real production before relying on it as a target.

## 2026-07-20 - Roadmap Phases Are Live Records

Decision:

- Store Roadmap phases in Supabase and expose protected phase create/update operations through `/api/roadmap/phases`.
- Give every Production song a phase assignment and shared release date.
- Derive phase counts, general release count, month status, and the overall timeline range from live song/phase data.
- Allow phase name, start month, end month, and description to be edited in nested Phase settings.
- Create new phases through one full-width action and assign the next phase number automatically.
- Keep song names as labels; make Production and Marketing statuses the direct links into their respective modules.

Reason:

- Roadmap should be a planning control surface, not a manually maintained infographic.
- Phase 4 `Go on tour` proved that the model can grow without adding another hardcoded card.
- Status links save mobile space while preserving fast navigation to the operational source.

## 2026-07-20 - Beta 1.9 Headline

Decision:

- Frame the upcoming beta as backlog refinement plus the first fully functional Roadmap module.
- Include the completed release-driven Production schedule and live Dashboard Roadmap preview in Beta 1.9.

Reason:

- The beta-by-beta story remains consistent: one meaningful functional module becomes real, accompanied by smaller improvements discovered through daily use.

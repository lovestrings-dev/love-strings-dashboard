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

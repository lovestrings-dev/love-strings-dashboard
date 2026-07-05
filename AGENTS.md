# Agent Context

## Project

Love Strings Sprint Dashboard is a web app for managing an independent music project release cycle.

Main goal: provide a daily command screen for production, marketing, platform growth, budget, roadmap, and sprint work.

## Current Stack

- App: Next.js 16, React 19, TypeScript
- Package manager: pnpm
- UI icons: lucide-react
- Database/backend: Supabase PostgreSQL
- Repository: GitHub `lovestrings-dev/love-strings-dashboard`
- Future hosting target: Vercel

## Current State

- Initial Supabase schema has been applied to the remote project.
- Manual platform metric seed data has been applied to the remote project.
- Local repo is linked to Supabase project ref `ezmphpcytohigfdtfvzm`.
- First Next.js dashboard/prototype shell exists at `app/page.tsx`.
- Supabase browser client helper exists at `lib/supabase/browser.ts`.
- Environment template exists at `.env.example`.
- Local `.env.local` exists on this machine with browser-safe Supabase public config. It is intentionally ignored by Git.
- `.env.local` also contains `YOUTUBE_API_KEY` for local YouTube Data API imports. Do not commit or print it.
- Basic Auth protection exists in `proxy.ts`. Set `APP_BASIC_AUTH_USER` and `APP_BASIC_AUTH_PASSWORD` in Vercel before sharing the deployed app. If either value is missing, the app remains open for local development.
- Local dev server runs at `http://localhost:3000`.
- Current navigation is in-page state, not route-based pages yet.

## Current UI Structure

Navigation order:

1. Dashboard
2. Marketing
3. Production
4. Platforms
5. Budget
6. Roadmap

Notes:

- `Sprints` remains in the database/product concept but is intentionally hidden from the main menu for now.
- Dashboard is the daily command screen.
- Marketing will cover content production tasks per release/sprint.
- Production will cover music production tasks per release/sprint.
- Platforms is the detailed platform statistics area.
- Budget is for profit/loss and financial detail.
- Roadmap is the strategic overview of the global Love Strings plan.

Current Marketing layout:

- Reads campaign records from Supabase when available, with local seeded/browser fallback.
- Shows multiple local campaign boards, sorted by saved release date newest/latest first.
- Seeded campaigns currently include `Rock and Roll`, `Flowers`, `Jukebox`, `Wonderful Life`, and `Intro`.
- `Long Time` was removed from seeded campaigns because it was only a demo name for `Rock and Roll`.
- Campaigns are seeded from code for now. Historical seed rows came from the Google Sheet `RELEASE MEDIA PLAN` tab in `Love Strings ADMIN`.
- `Rock and Roll` release date is `10/07/2026`.
- Campaign windows are 14 days by default and start 4 days before release.
- Rows show weekday/date plus release offset, then one `Campaign tasks` cell.
- Each campaign task cell has a manually editable clip name field.
- Each campaign task cell has three local-status controls: `Make video / post`, `IG Upload`, and `YT upload`.
- Each campaign task cell has a local `Add task` button for extra ad hoc tasks; test placeholders exist on campaign day 3 and day 14. Extra tasks can be deleted locally so accidental tasks do not affect completion percentage.
- Status options: `Not started`, `In progress`, `Done`.
- Status dot colors: red = not started, orange = in progress, green = done.
- The campaign header includes album art, release title, the next three campaign tasks that are not done, editable release date in `dd/mm/yyyy` format, days-before-release countdown above the formatted date, and a dropdown toggle that opens the daily campaign table. The table is collapsed by default.
- Campaign title can be edited locally with a compact pencil/save control.
- Release date changes use a compact save icon. Saving a release date recalculates campaign day dates and re-sorts the campaign list.
- Album art can be set via direct external URL. `Rock and Roll` currently uses a Cloudinary `res.cloudinary.com` delivery URL.
- A compact progress strip is attached under the campaign header: the sprint completion percentage is shown before the day boxes. One square represents one campaign day. Green means all tasks for that day are done; yellow means at least one task is done but not all; red means nothing is done. The current/nearest campaign day square has a black outline.
- Extra campaign days can be added after day 14 and deleted locally if added by accident. The default 14 days cannot be deleted.
- New campaigns can be added locally with `Add campaign`. A new campaign has its own title, release date, album art URL, campaign days, tasks, add-day/add-task controls, and progress strip.
- Campaigns can be deleted locally, but deletion is protected: open the campaign details, expand `Campaign options`, tick the confirmation checkbox, then press `Delete campaign`. This is intentionally hidden from the collapsed mobile header to avoid accidental deletion.

Current Dashboard layout:

- First platform row: Instagram, YouTube Channel
- Second platform row: Spotify, YouTube Music, Apple Music
- Under platform stats, Dashboard shows a local `Now & Next` campaign preview:
  - Current campaign: active if today's date is inside the 14-day campaign window.
  - Next campaign: nearest future release campaign.
- Dashboard campaign preview uses the same campaign state as Marketing. Campaigns are loaded from Supabase when available, with local fallback.
- Then Focus Queue and System Status panels

Current Platforms layout:

- First row: Instagram, YouTube Channel
- Second row: Spotify, YouTube Music, Apple Music
- Third row: Amazon Music, Deezer, New Platform
- `New Platform` is UI-only placeholder data and is not connected to Supabase.

## Supabase

Migrations applied:

- `supabase/migrations/202606290001_initial_schema.sql`
- `supabase/migrations/202606290002_seed_platform_dashboard_metrics.sql`
- `supabase/migrations/202607010001_create_marketing_campaigns.sql`

Initial tables:

- `songs`
- `releases`
- `release_songs`
- `platforms`
- `platform_accounts`
- `content_posts`
- `platform_metric_snapshots`
- `sprints`
- `tasks`
- `budget_transactions`
- `import_logs`
- `marketing_campaigns`
- `marketing_campaign_days`
- `marketing_campaign_tasks`

RLS is enabled on all project tables.

Read policies currently allow anonymous reads for public dashboard data:

- `platforms`
- `platform_accounts`
- `content_posts`
- `releases`
- `platform_metric_snapshots`
- `marketing_campaigns`
- `marketing_campaign_days`
- `marketing_campaign_tasks`

Temporary prototype write policies allow anonymous writes to Marketing campaign tables only. Replace these with authenticated policies before public launch.

Current seeded metric source:

- `source = 'manual-dashboard-seed'`
- `snapshot_date = '2026-06-29'`

Current YouTube API import source:

- `source = 'youtube-data-api'`
- First imported snapshot date: `2026-06-30`
- Channel handle: `@LoveStringsBand`
- Channel ID: `UCo5TO_E4TD9cgXw4wkUjr4w`
- The importer discovers the latest regular video and latest Short from the channel uploads playlist.
- Short detection currently uses a configurable duration heuristic: `YOUTUBE_SHORT_MAX_SECONDS`, default `180`.
- Fallback latest full video ID: `uoJpyT6ktlk`
- Fallback latest Short ID: `EtL-6xXKYjA`

Seeded platform values:

- Instagram: followers 184, accounts reached last 30 days 3500, latest reel/post views 2100
- YouTube Channel: subscribers 39, latest video views 39, latest short views 19
- YouTube Music: subscribers 11, total plays 75, current release plays 15
- Spotify: followers 10, total streams 19, current release streams 4
- Apple Music: listeners 5, total plays 3, current release plays 1
- Amazon Music: listeners 3, total streams 4, current release streams 2
- Deezer: fans 2, total streams 4, current release streams 2

Database metric values are numeric and should remain raw numbers, not display strings. The UI formats them as plain numbers or compact values such as `3.5K`.

Current campaign seed source:

- Supabase campaign seed data lives in `supabase/migrations/202607010001_create_marketing_campaigns.sql`.
- Local fallback campaign seed data still lives in `app/page.tsx`.
- Historical campaign seed source: Google Sheet `Love Strings ADMIN`, tab `RELEASE MEDIA PLAN`, export gid `1970846657`.
- The Marketing UI now reads from `marketing_campaigns`, `marketing_campaign_days`, and `marketing_campaign_tasks` when Supabase is available.
- Campaign title/date changes, campaign deletion, new campaigns, and day/task plan changes are written back to Supabase through prototype anon write policies.
- Browser/local fallback remains useful during development if Supabase is temporarily unavailable.

## Useful Commands

Use Codex bundled Node/pnpm if system Node is unavailable:

```bash
PATH=/Users/sun_mac_m1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/sun_mac_m1/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH pnpm run dev
```

Normal project commands:

```bash
pnpm install
pnpm run dev
pnpm run typecheck
pnpm run lint
pnpm run build
```

Supabase migration status:

```bash
pnpm dlx supabase migration list
```

YouTube API import:

```bash
pnpm run import:youtube
```

Dry run without writing to Supabase:

```bash
node scripts/import-youtube-metrics.mjs
```

## Verification Baseline

The scaffold and platform metric work have previously passed:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- Browser smoke test for `http://localhost:3000`

Most recent verified behavior:

- Dashboard hides Amazon Music and Deezer.
- Dashboard shows Instagram, YouTube Channel, Spotify, YouTube Music, and Apple Music.
- Platforms shows all seeded platforms plus UI-only `New Platform`.
- Supabase migration list shows local/remote `202606290001` and `202606290002`.
- YouTube Data API import wrote `youtube-data-api` rows for subscribers, latest video views, and latest short views.
- Browser console check had no warnings/errors after fresh server restart.
- After macOS update on 2026-07-01, infrastructure health check passed:
  - Node `v24.14.0`
  - pnpm `11.7.0`
  - `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`
  - Supabase CLI remote migration list
  - YouTube dry-run reached Google and discovered latest channel uploads
  - Dev server responded on `http://localhost:3000`

## Product Context

Read these first:

- `PROJECT_BRIEF.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/supabase-setup.md`
- `docs/decisions.md`

Key product areas:

- Main dashboard
- Production
- Marketing/release calendar
- Budget
- Platforms
- Backlog
- Roadmap

Hidden/latent product area:

- Sprints, currently modeled in the database but not visible as a top-level nav item.

Important source data to import later:

- `/Users/sun_mac_m1/Documents/LOVE STRINGS/Love Strings ADMIN.xlsx`
- `/Users/sun_mac_m1/Documents/LOVE STRINGS/Love Strings Roadmap.pdf`

## Next Priorities

1. Set up Vercel deployment and environment variables.
2. Share the Basic Auth credentials with Yullia after deployment is verified.
3. Commit/push current UI/backend work via GitHub Desktop if terminal Git auth still fails.
4. Decide whether to convert in-page nav state into real Next.js routes.
5. Import workbook and Google Sheet campaign data into normalized Supabase tables.
6. Replace remaining manual metric seed workflow with proper update/import flow.

## Development Time Tracking

- Track approximate project work time in `docs/development-work-log.md`.
- Use Europe/Vienna local time.
- Add one row per focused development session and tag work by stage, such as `Architecture`, `Infrastructure`, `Marketing UI`, `Marketing Backend`, `Platform APIs`, `Production Tracker`, `Content Notes`, or `Maintenance`.
- When exact timing is unavailable, use conservative estimates and mark them as estimated.
- Update the running summary when a session ends or when Dmitrii provides a known duration.

## Codex Role

Codex is best described in project materials as:

**Codex Build Assistant**

Role: helps design the system, write code, run checks, connect tools, explain architecture, and guide setup. Codex is not currently a deployed runtime service inside the Love Strings app.

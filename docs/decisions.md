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
- Use a daily 06:00 Europe/Vienna scheduled collector as the official daily snapshot target.
- Use GitHub Actions for the production scheduler because it can send the required `Authorization: Bearer CRON_SECRET` header to the protected endpoint.

Current working API metrics:

- YouTube Channel subscribers.
- YouTube latest regular video title and views.
- YouTube latest Short title and views.
- YouTube Music Topic channel subscribers.
- YouTube Music total plays from Topic channel views.
- YouTube Music current release plays from the latest Topic channel track.
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
- The scheduler calls `https://love-strings-dashboard-love-strings-dashboard.vercel.app/api/metrics/refresh?scheduled=1` at 04:05 UTC and 05:05 UTC. The endpoint's Europe/Vienna time guard skips the non-06:00 run so daylight saving time does not break the daily schedule.
- YouTube Music first uses the public Topic channel ID `UCKlfg9lYKyMOg_Oiz-Zb1Fg` with the existing YouTube Data API key. OAuth-based YouTube Analytics may be revisited later if we need deeper artist-only metrics.

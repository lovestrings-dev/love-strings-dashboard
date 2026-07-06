# Development Work Log

Purpose: track approximate Love Strings Dashboard build time by day and by development stage.

This is a practical project-management log, not a strict timesheet. When exact start/end times are unavailable, use conservative estimates and mark them as estimated.

## Tracking Rules

- Use Europe/Vienna local time.
- Add one row per focused development session.
- When a session starts, record the start time and stage.
- When a session ends, add the end time, duration, and short outcome.
- If exact timing is missing, use `estimated` in the `Confidence` column.
- Keep topic tags short and reusable so totals stay easy to calculate.

## Stage Tags

- `Architecture`: product shape, system design, project structure, decisions.
- `Infrastructure`: GitHub, Supabase, CLI access, migrations, environment setup.
- `Marketing UI`: Marketing campaign layout, Dashboard campaign previews, campaign workflow UX.
- `Marketing Backend`: campaign database tables, seed data, Supabase persistence.
- `Platform APIs`: YouTube/Instagram/Spotify/etc. API import logic.
- `Production Tracker`: music production workflow module.
- `Content Notes`: notes for reels/posts about building the app.
- `Maintenance`: docs, cleanup, verification, handoff notes.

## Running Summary

| Stage | Approx. Time | Notes |
| --- | ---: | --- |
| Architecture | TBD | Initial app direction, modules, navigation, architecture notes. |
| Infrastructure | 0h 12m + earlier TBD | GitHub, Supabase, CLI access, migrations, YouTube API setup, Vercel deployment, GitHub Actions scheduler. |
| Marketing UI | 0h 45m + earlier TBD | Marketing campaign cards, dashboard previous/current/next previews, task workflow, album-art autosave polish. Earlier UI build still needs historical estimate. |
| Marketing Backend | 0h 14m + earlier TBD | Supabase campaign schema, seed migration, first UI read/write wiring, album-art persistence. Earlier migration work still needs historical estimate. |
| Platform APIs | 2h 34m + earlier TBD | YouTube and Instagram importers, YouTube Music Topic channel collector, live API verification, 30-day Instagram reach/views, server refresh endpoint, snapshot policy, scheduled refresh wiring. |
| Production Tracker | 0h 00m | Not started yet. |
| Content Notes | 0h 10m | Build-story log for future Instagram Reels/Shorts about the dashboard creation process. |
| Maintenance | 0h 43m | Time tracking setup, changelog/versioning, project context/docs updates. |

Known exact/near-exact time so far:

- Early build session reported by Dmitrii: `1h 42m`. Exact date/stage split needs confirmation.

## Session Log

| Date | Start | End | Duration | Confidence | Stage Tags | Outcome |
| --- | --- | --- | ---: | --- | --- | --- |
| TBD | TBD | TBD | 1h 42m | user-reported | Architecture, Infrastructure, Marketing UI | Early build session from rough idea to working prototype. Exact date and split are not yet confirmed. |
| 2026-07-05 | 09:30 | 09:43 | 0h 13m | exact | Maintenance, Marketing Backend | Created project time/stage tracking log, then wired Marketing campaign reads/writes to Supabase for shared use. Approx split: Maintenance 9m, Marketing Backend 4m. |
| 2026-07-05 | TBD | TBD | 1h 25m | estimated | Maintenance, Platform APIs, Marketing UI | Added Beta 1.0 version marker/changelog, polished mobile task readability in Dashboard/Marketing, tested new YouTube Short import, built Instagram importer, added Instagram 30-day reach/views, and verified dashboard values from Supabase. Approx split: Platform APIs 60m, Marketing UI 15m, Maintenance 10m. |
| 2026-07-06 | 09:00 | 09:50 | 0h 50m | estimated | Marketing UI, Marketing Backend, Platform APIs, Maintenance | Fixed album-art URL autosave to Supabase, refreshed YouTube latest Short views to 1.1K, added protected server-side metrics refresh endpoint and Dashboard Refresh button, confirmed snapshot policy, and updated project docs. Approx split: Platform APIs 25m, Marketing UI 10m, Marketing Backend 10m, Maintenance 5m. |
| 2026-07-06 | TBD | TBD | 0h 20m | estimated | Infrastructure, Platform APIs, Maintenance | Published and verified Beta 1.1, added GitHub Actions daily metrics scheduler for the protected refresh endpoint, and updated project architecture/decision/changelog notes. Approx split: Infrastructure 12m, Platform APIs 4m, Maintenance 4m. |
| 2026-07-06 | TBD | TBD | 0h 15m | estimated | Content Notes, Maintenance | Added a build-story log for future Instagram Reel/Short storytelling, including timeline beats, platform setup moments, and draft Reel angles. Approx split: Content Notes 10m, Maintenance 5m. |
| 2026-07-06 | TBD | TBD | 0h 20m | estimated | Platform APIs | Tested the Love Strings YouTube Music Topic channel through the existing YouTube Data API and added a server-side YouTube Music collector for subscribers, total plays, and current release plays. |

## How To Update Totals

When a session ends:

1. Add or complete the row in `Session Log`.
2. Split the duration across stage tags when one session covers multiple areas.
3. Update `Running Summary` with the new approximate totals.
4. If the split is unclear, keep the total in the dominant stage and mention the secondary stage in `Outcome`.

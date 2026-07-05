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
| Infrastructure | TBD | GitHub, Supabase, CLI access, migrations, YouTube API setup. |
| Marketing UI | TBD | Marketing campaign cards, dashboard previous/current/next previews, task workflow. |
| Marketing Backend | 0h 04m + earlier TBD | Supabase campaign schema, seed migration, and first UI read/write wiring. Earlier migration work still needs historical estimate. |
| Platform APIs | TBD | YouTube metrics importer and daily snapshot logic. |
| Production Tracker | 0h 00m | Not started yet. |
| Content Notes | TBD | Separate storytelling/reel idea notes. |
| Maintenance | 0h 09m | Time tracking setup and project context updates. |

Known exact/near-exact time so far:

- Early build session reported by Dmitrii: `1h 42m`. Exact date/stage split needs confirmation.

## Session Log

| Date | Start | End | Duration | Confidence | Stage Tags | Outcome |
| --- | --- | --- | ---: | --- | --- | --- |
| TBD | TBD | TBD | 1h 42m | user-reported | Architecture, Infrastructure, Marketing UI | Early build session from rough idea to working prototype. Exact date and split are not yet confirmed. |
| 2026-07-05 | 09:30 | 09:43 | 0h 13m | exact | Maintenance, Marketing Backend | Created project time/stage tracking log, then wired Marketing campaign reads/writes to Supabase for shared use. Approx split: Maintenance 9m, Marketing Backend 4m. |

## How To Update Totals

When a session ends:

1. Add or complete the row in `Session Log`.
2. Split the duration across stage tags when one session covers multiple areas.
3. Update `Running Summary` with the new approximate totals.
4. If the split is unclear, keep the total in the dominant stage and mention the secondary stage in `Outcome`.

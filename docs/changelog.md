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
- Daily 06:00 Europe/Vienna snapshot policy documented.
- Vercel deployment verified with the manual refresh returning `Updated 2 data collectors.`

## Beta 1.2

Candidate scope:
- Production scheduler verification after the first automatic 06:00 Europe/Vienna run.
- Deployment hardening for recurring API imports.

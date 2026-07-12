# Open Questions

## Platform API Research

- Spotify: parked until access is available. Need confirm whether Web API access is blocked by account tier or developer/app setup.
- Deezer: investigate whether artist stats are available by API or only public catalog data.
- Amazon Music: investigate whether artist analytics are available by API or only through Amazon Music for Artists/manual exports.
- Website/Google statistics: investigate Google Analytics or Search Console API access and decide which widget belongs on Dashboard.

## Dashboard Metrics

- How should "estimated total audience" be calculated?
  - Sum of followers/subscribers/listeners/fans across platforms?
  - Deduplicated estimate with a conservative overlap factor?
  - Separate "audience size" from "last 30 days reach/views"?
- Which platform links should be attached to Dashboard card headers?
- What should the Dashboard In Focus section prioritize when multiple tasks are due?

## Beta 1.2 Follow-Ups

- Production: when adding a new song, default its production deadline to the latest existing song deadline plus 2 weeks so the new card naturally appears at the bottom before editing.
- Events UI: align the titles of the first two cards with their pictograms.
- Platforms UI: refine graph visuals before expanding the number of graphs per platform.
- Platforms integrations: connect remaining available platform data sources.
- Roadmap: replace manually set progress visuals with automatic logic.
- Budget future link: allow Marketing campaign expenses, such as ads, photoshoots, or campaign-specific production costs, to feed the Budget module.

## Marketing

- Should "update Apple Music" appear on both first and last campaign day for every campaign by default?
- Should Apple Music import reminders be linked to the Apple Music CSV import workflow in Platforms?

## Platforms Analytics

- What graph time ranges should be default: 7 days, 14 days, 30 days, campaign period, all time?
- Should audience evolution show separate platform lines plus a total audience line?
- How should manual CSV imports such as Apple Music be displayed next to daily API snapshots?

## Production Planning

- What are the standard production phases for a Love Strings release?
- Should production planning be song-based, release-based, or campaign-based?
- Which production task statuses should match Marketing statuses?

## Budget

- What minimum fields are needed for v1.0: amount, type, category, date, note, platform/vendor?
- Should budget connect to releases, campaigns, shows, or all of them?
- What counts as "current budget balance" for Dashboard: cash balance, project P/L, or campaign budget remaining?

## Shows

- Should shows become a separate tab?
- What is the minimal show record: date, venue/location, status, fee/cost, tasks, notes?
- Should show tasks appear in Dashboard In Focus?

## Other Tasks

- Where should non-marketing/non-production tasks live?
- Should they be module-linked when possible, or all go into a general task pool?
- How should manually added non-standard tasks appear in Dashboard In Focus?

## Voice Control

- What actions should voice control support first?
- Should voice commands create drafts that Dmitrii confirms before saving?
- How should the app prevent accidental destructive voice changes?
- Which data modules must be stable before voice control begins?

## Beta 1.4 Mobile Polish

- The 2026-07-07 mobile full-page screenshot set shows that some current sections compress or overflow awkwardly on narrow mobile width. Decide whether the next UI tidy-up should first address navigation overflow, card width behavior, or long campaign/task content wrapping.
- Real mobile phone testing after Beta 1.3 found the next concrete polish list:
  - Next session: test the first Beta 1.4 mobile pass on a real phone and compare against the checklist before starting deeper feature work.
  - Marketing cards should fit mobile screen width on the Marketing tab.
  - Marketing campaign day dates and Production step dates should stay as left-side section markers on desktop, but become top headers for each day/step on mobile.
  - Dashboard Budget snapshot should become: current balance row, projected earn/spend row, projected balance row.
  - Dashboard should not scroll beyond the bottom of the last card into blank space.
  - Dashboard should visually split its main sections into clear unified blocks: Events, In Focus, Platform Stats, Marketing, Production, Budget, and Roadmap.
  - Dashboard section headers should use a unified placement/style across all dashboard blocks.
  - Dashboard platform cards should show last update dates where platform data has automatic or manual update timestamps.
  - Dashboard Marketing card fonts should be increased or returned closer to the other card font sizes.
  - Marketing tab header/nav should not appear clipped; Marketing tab font sizes should match Dashboard/Production readability.
  - Marketing tab should not scroll into unnecessary blank bottom space.
  - Platforms metric subcards should use two cards per row on mobile instead of horizontal scrolling inside platform cards.
  - Platforms tab should not scroll into unnecessary blank bottom space.
  - Budget summary cards should keep three cards per row on mobile if practical.
  - Budget ledger rows should split into two sub-lines on mobile: date/description first, amount/type/actions second, with long descriptions wrapping taller instead of overflowing.
  - Roadmap monthly progress should reflow into natural four-month rows on mobile, with first/last partial rows aligned to preserve the season-like rhythm.

## QR Codes

- QR Codes dropdown on Dashboard and Platforms is useful for sharing Love Strings links from a phone screen, but the current Beta 1.4 implementation stores QR edits in local browser state only. Decide when to move QR code records into Supabase so Dmitrii and Yuliia share the same QR list across devices.

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

## UI Cleanup

- The 2026-07-07 mobile full-page screenshot set shows that some current sections compress or overflow awkwardly on narrow mobile width. Decide whether the next UI tidy-up should first address navigation overflow, card width behavior, or long campaign/task content wrapping.

# Spotify Evolution redesign completion — 2 November 2026

Implemented locally; pending the later combined deployment. No Stage B work started.

## Delivered behavior

Four charts retain the green Followers, amber Monthly Active Listeners, purple Listeners, and blue Streams palette. Desktop uses two columns; screens at or below 700px use one. Responsive SVG view boxes fill the plot width, with readable axes, subtle horizontal gridlines, thin lines, and observation markers. There is no chart animation or new dependency.

Shared 30D / 90D / 1Y / All and Absolute / Growth controls update all charts. Defaults are 90D and Absolute. Selection lives in the parent app state and survives leaving and returning to Platforms during the same page session; a reload resets it. Hover, pointer/touch down, and keyboard arrows/Home/End inspect recorded points. Escape clears selection. Inspection details sit below the plot so they stay inside the card and do not cover data.

## Files for this task

- `app/components/spotify-evolution.tsx`: Spotify-only panel, paginated reader, reusable chart, controls and inspection.
- `lib/spotify-evolution.ts`: pure series selection, interval, domain and row-mapping utilities.
- `app/page.tsx`: parent selection state and Spotify panel wiring; removes obsolete Spotify trend preparation.
- `app/globals.css`: scoped Spotify styles and responsive layout.
- `scripts/test-spotify-evolution.mjs`: calculation, data integrity, pagination and reader failure checks.
- `package.json`: `test:spotify-evolution` command.
- `docs/development-work-log.md`: session tracking.
- This completion report.

Earlier Marketing and Google-card fixes remain in the working tree for the combined deployment. Their regression scripts are separate from this redesign.

## Existing chart approach and source

The project uses custom React SVG charts, not a third-party chart library. This implementation reuses SVG, the existing Evolution disclosure styling, lucide ChevronDown, app palette and Supabase browser client. Other modules retain PlatformTrendPanelGroup and PlatformLineChart unchanged.

The general metrics query can hit Supabase's row cap and omit older Spotify rows. Browser verification initially showed only one October observation even in All. The new panel independently reads the existing `spotify-audience-csv` snapshots, filtered to the active workspace, Spotify, and the four requested metrics. Stable ordering and 500-row pagination avoid that truncation. A cancelled request cannot commit after unmount/workspace change. Failed reads show an explicit error and do not present partial history as complete. This is a read-only chart data-loading change; it does not change collection, imports, KPI calculations or stored data.

## Interval and calculations

All charts share an interval ending on today's date in the workspace timezone. 30D and 90D include today plus the preceding 29 or 89 days. 1Y uses the same date in the previous calendar year, clamping February 29. All begins at the earliest stored observation among the four series. Future observations are excluded.

Each series retains only actual finite observations; null, blank and invalid values are skipped, while recorded zero remains zero. For duplicate metric/date observations, the latest imported value wins. No missing dates are created, interpolated or carried forward. Lines are visual connectors between recorded points only.

Absolute mode plots recorded values. Growth subtracts the first available observation inside the selected interval, independently for each metric; the baseline date is displayed. Summary change requires two observations, otherwise it is unavailable. A single available baseline can display growth zero without implying an earlier observation exists. Tooltips show exact dates, full recorded values, growth when selected, and difference from the previous available recorded observation (including an earlier observation outside the selected interval when present). Empty periods show Unavailable, not zero. No percentages are calculated.

## KPI versus chart discrepancy

The existing importer stores only the first meaningful observation per month in `spotify-audience-csv`. It separately stores latest Followers and Monthly Active Listeners under `spotify-audience-current-csv`. Streams/catalog KPI values come from Songs CSV reporting, a different source and aggregation. These existing behaviors are unchanged.

Verified in Love Strings: the history now has seven monthly observations from 22 April to 1 October 2026. The last Followers point is 14 and Monthly Active Listeners is 2 on 1 October. KPI values are 17 and 6 from the latest Audience data dated 27 October. The Streams chart endpoint is 2 for its Audience observation, while Total Catalog Streams is 83 from the Songs report. These are different dates/sources, not a chart calculation error. The UI states the history source and each metric's latest observation date.

## Verification

- Spotify Evolution tests: interval boundaries, leap year, empty/sparse data, zero baseline, negative growth, previous-observation deltas, duplicate-date precedence, null/blank rejection, flat/empty domains, 1,103-row pagination and error handling.
- Existing Spotify audience-history, Marketing creation and Google connection regressions passed.
- TypeScript, ESLint, production build and diff integrity passed.
- Browser: desktop at 1440px confirmed two columns; 390px confirmed one column with document width equal to viewport (no horizontal overflow). All/90D/30D, Absolute/Growth, navigation persistence, keyboard inspection, pointer inspection, and explicit empty-period states verified. Console had no warnings or errors at inspection.
- Native mobile hardware was not used; pointer handling and narrow viewport were verified in the browser. No deployment or database mutation performed for this task.

## Limits and possible Stage B

History remains monthly because that is what existing imports saved; shorter periods may have zero or one observation. Range selections persist for the page session only. A future separately approved Stage B could consider denser retained history, annotations, comparison overlays, exports or drag-to-zoom. None is implemented here.

## Follow-up — shared Platforms rollout

The subsequent approved task extended this design to every existing Platforms graph group. Shared rendering now lives in `app/components/evolution-panel.tsx`, with common calculations in `lib/platform-evolution.ts`; the Spotify component retains its source-specific read and explanation. Period and mode selections are shared across the Platforms module. See `docs/platform-evolution-rollout-2026-11-02.md` for verification.

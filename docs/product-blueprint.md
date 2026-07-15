# Product Blueprint

Purpose: keep the product direction clear enough that Codex can suggest useful next steps when Dmitrii asks, "what can we do next?"

This is not a strict sprint plan. It is a future-proof map of the app we are building.

## Product Vision

Love Strings Dashboard should become the daily operating system for an independent music project.

It should combine:

- platform statistics
- release marketing tasks
- production planning
- budget tracking
- roadmap tracking
- show tracking
- general task capture
- later, voice-driven updates

The app should stay useful for Dmitrii and Yuliia first. Only after the internal workflow becomes strong should it be adapted for other musicians.

## Original Project Brief

The project began as an "executive dashboard" idea, then quickly became more specific: a mobile and desktop web dashboard for Love Strings.

Core goal:

Support a steady release cycle of one song every 2-3 weeks while keeping production, marketing, platform performance, and cash flow visible in one place.

Original source data:

- `PRODUCTION` tab: song pipeline, release order, style notes, production readiness, instrumentation status, demos, BPM, and blockers.
- `RELEASE MEDIA PLAN` tab: release/media calendar, Instagram and YouTube content planning, posting schedule, campaign checklist, and release milestones.
- `BUDGET` tab: income, spending, balance, profit/loss, upcoming costs, and upcoming income.

Original dashboard questions:

- What release cycle are we working on now?
- How many days remain until the next release?
- What production work is done, blocked, or overdue?
- What marketing/content work is ready, scheduled, posted, missing, or overdue?
- Are live show and event earnings covering production and marketing spend?
- Which platforms are growing and which need attention?
- What should be done today?
- What should improve in the next sprint?

Original design direction:

- focused executive/operations dashboard
- fast daily scanning
- mobile usability
- compact cards and tables
- drill-down only when needed
- status colors for done, planned, blocked, overdue
- calendar and task views that support release-cycle execution

Original MVP direction:

Start with manual/workbook-style data and useful screens before adding APIs. API integrations should come later once the dashboard has a clear daily workflow.

## Version Plan

Beta release pattern:

- Each `Beta 1.x` release should have one main functional-module headline.
- The same beta can also include backlog fixes, UI polish, small cross-module improvements, and bug fixes found while testing earlier releases.
- For storytelling, describe each beta as one clear capability step plus the real-world cleanup that made the app more usable.

Current near-term sequence:

- Beta 1.5: Events module persistence and event-linked Budget flow.
- Beta 1.6: Budget module persistence, plus Address Book persistence fix and other small post-Beta 1.5 refinements.

### Version 1.0 - Internal Operating Dashboard

Goal:

Create a reliable private app that Love Strings can use every day for campaigns, production, platform stats, budget, roadmap, shows, and current priorities.

This version is for Dmitrii and Yuliia, not yet for public users.

Main workstreams:

1. Platform data connections
2. Dashboard summary metrics
3. Marketing workflow refinement
4. Platforms analytics views
5. Production planning module
6. Budget tracker
7. Roadmap tracker
8. Shows and general task tracking
9. UI cleanup and mobile polish

### Version 2.0 - Voice-Controlled Assistant Layer

Goal:

Allow Dmitrii to update the app naturally by speaking or dictating tasks, ideas, and status changes.

Example commands:

- "I have an upcoming concert on this date in this location. Create a new show record."
- "I have an idea for a new Reel for the Rock and Roll campaign. Call it jumping photos and add it to the campaign."
- "I finished vocal production for Shallow. Mark it as done."

Voice control should manipulate existing app data structures rather than invent a separate parallel notes system.

### Version 3.0 - Adaptable App For Other Musicians

Goal:

If people react strongly to the build-story content and want a similar tool, adapt the app so other musicians can set it up with minimal technical work.

This would require:

- onboarding flow
- user/team accounts
- per-artist configuration
- safer permission and data isolation model
- simpler API setup instructions
- clearer templates for campaigns, platforms, shows, and budgets
- product positioning beyond the Love Strings internal workflow

## Version 1.0 Candidate Backlog

### Platform Integrations

- Connect Spotify API when access is available again. Current status: parked.
- Investigate Deezer API.
- Investigate Amazon Music API.
- Investigate Google/website statistics API.
- Add a website statistics widget if useful data is available.

### Dashboard Metrics

- Add estimated total audience metric.
- Current budget balance and upcoming balance are now copied onto Dashboard from the Budget module.
- Make platform card headers clickable links to the actual external platform pages.
- Make the In Focus section functional:
  - current marketing task
  - current production task
  - current other/non-standard task
- Dashboard now acts as the command screen by copying summary cards from Events, Marketing, Production, Budget, and Roadmap. Future work should keep this screen compact and avoid turning it into another full-detail tab.

### Marketing Module

- Add default campaign tasks for the first and last day:
  - "update Apple Music"
- Keep the existing campaign concepts: campaign header, progress bar, daily tasks, statuses, extra tasks, and release date logic.
- Marketing campaign names now come from Production song names.
- Creating a new Marketing campaign uses a dropdown of songs already present in Production.
- Marketing displays album art from the matching Production song. If Production has no album-art URL yet, Marketing shows a generic pending artwork placeholder.
- This is still title-matched in the prototype. The future backend should replace title matching with a stable shared song/release id.

### Platforms Module

- Apple Music import has been moved from Dashboard to the Apple Music card in Platforms.
- Apple Music display cleanup is in place: no duplicate last-update date, no standalone current release metric, no CSV filename under totals.
- Create evolution views for each platform.
- Create audience evolution view across platforms.
- Use daily Supabase snapshots as the foundation for graphs and trend views.

### Production Module

- First UI-only prototype exists in `app/page.tsx`.
- Source data now comes from `docs/source-data/Love Strings ADMIN.xlsx`, sheet `PRODUCTION`.
- One card represents one song.
- Header includes artwork URL, editable song name, next three unfinished production tasks, production deadline, countdown, and expandable details.
- Progress boxes represent production steps, not campaign days.
- Default steps: Demo, Drums, Guitars, Bass, Vocals, Edit, Mix, Master, License, Cover Art, Distributor.
- Extra steps do not exist by default; they are added manually with `Add production step`.
- Detail rows represent production steps. Each step has editable deadline, notes, one standard `Complete step` task, and optional extra tasks.
- Production is now the source of truth for song names and album-art URLs used by Marketing.
- Production steps can carry budget rows that generate corresponding Budget ledger rows. License and Distributor have default spend values for repeated release costs.
- Production songs can be safely deleted through a protected UI flow.
- Beta 1.3 backend direction: Production should use normalized Supabase records for songs, production steps, extra step tasks, and production budget rows. Browser reads are allowed through read policies, while writes go through a server-side API route using the service key.
- Marketing still links to Production by song-title matching for now. Future backend should add a stable song/release id relationship between Marketing campaigns and Production songs.
- Current seed includes 27 production rows from the workbook. Future release dates are predicted every 3 weeks after `Rock and Roll`, with production deadlines 14 days before release.

Possible production areas:

- arrangement
- recording
- vocals
- strings
- editing
- mixing
- mastering
- artwork/video assets
- distribution readiness

### Budget Module

- First UI-only budget tracker is built from `Love Strings ADMIN.xlsx`, sheet `BUDGET`.
- Header tracks total earned, total spent, current balance, projected earn month ahead, projected spend month ahead, and projected balance month ahead.
- Editable manual ledger rows are persisted through the Budget API and Supabase tables, with browser local storage kept as a fallback.
- Recurring rows generate near-term forecast rows without storing every generated occurrence as a manual ledger entry.
- Events, Marketing, and Production can generate read-only Budget rows from their own source records.
- Hidden/deleted generated Budget rows are persisted as preferences so the Budget view can stay tidy across refresh and devices.
- Hidden/deleted generated-row preferences now apply only to recurring forecast rows; Events/Marketing/Production generated rows must be corrected in their source module so analytical cards do not silently lose source data.
- First Budget source-bucket analysis layer is implemented with `Events`, `Production`, and `Marketing` buckets.
- Budget shows six bucket summary cards: three since-start totals and three one-month-forward projections.
- Manual Budget rows have a bucket selector so costs like Canva or SUNO can be assigned to the correct business area.
- Generated rows inherit their bucket from the source module: Events, Marketing campaigns, or Production songs.

### Roadmap Module

- First UI-only roadmap tracker is built from `Love Strings Roadmap.pdf`.
- It shows 3 strategic phases: English Covers / Brand Formation, Russian Covers, and Original Songs.
- The top progress strip uses monthly boxes grouped by phase with wider spacing and phase separators.
- Phase cards use release boxes: green for released, orange for active/current work, white for planned.
- Backend persistence and live links to Production/Marketing status are still pending.

### Shows Module

- First UI-only Events tab exists and should become the Shows/Events module.
- Historical seed data comes from the Love Strings website news archive.
- The top summary card is future-looking: `Next event`, weekday/date, days left, and `No upcoming events planned yet` when all known events are in the past.
- Track at minimum:
  - date
  - location
  - event name
  - event link
  - location link
  - address
  - address link
  - future status/notes/tasks
- Future backend should persist events and feed `potential earn` into Budget's upcoming balance.

### Other Tasks

- Design logic for tasks that are not marketing, not production, and not shows.
- Decide whether these live in:
  - a general Tasks tab
  - the Dashboard In Focus section
  - related modules as manually added non-standard tasks

### UI Polish

- Tidy up the UI after core modules exist.
- Keep mobile-first behavior.
- Preserve before/after screenshots for storytelling whenever visible modules change.

## Suggested Next-Step Logic

When choosing what to do next, prefer this order:

1. Fix or verify infrastructure that protects daily data collection.
2. Move misplaced features into their long-term module homes.
3. Add small dashboard summary metrics that make the app more useful every day.
4. Build one new module at a time, starting with the module most useful for the current Love Strings workflow.
5. Polish UI only after the underlying workflow is clear, unless the current UI blocks real use.

Near-term practical candidates:

- Move Apple Music import from Dashboard to Platforms.
- Add estimated total audience to Dashboard.
- Investigate Deezer API or website statistics.
- Start Production module design from the Marketing module pattern.

# Love Strings Sprint Dashboard - Project Brief

## Project Concept

Love Strings needs a mobile and desktop web dashboard that works as a daily operating system for the music project.

The dashboard should support an agile-hybrid workflow where each 2-3 week sprint is centered around one song release. It should help track production, marketing, platform performance, content execution, and project finances in one place.

The main goal is to build a steady release cycle: release one song every 2-3 weeks while keeping production, marketing, and cash flow under control.

## Core Decision Questions

- What song/release cycle are we currently working on?
- How many days remain until the next release?
- What production work is done, blocked, or overdue?
- What marketing/content work is ready, scheduled, posted, missing, or overdue?
- Are live show and event earnings covering production and marketing spend?
- Which platforms are growing and which need attention?
- What should be done today?
- What should be improved in the next sprint?

## Main Dashboard

The main summary tab should be the daily command screen. It should show only the highest-signal information:

- Current strategic roadmap phase and next long-term milestone
- Current sprint and current song/release
- Release date countdown
- Today and upcoming to-dos
- Overdue tasks and blockers
- Production completion status
- Marketing/content completion status
- Budget snapshot: earned, spent, balance, upcoming costs
- Platform growth snapshot: streams, views, subscribers/followers, engagement
- Recent wins: strong posts, stream/view spikes, gigs, bookings, milestone growth

The main dashboard should include a compact Strategic Roadmap card:

- Current phase
- Progress toward current milestone
- Next milestone
- Strategic health: on track, at risk, or delayed
- Today's work in context of the long-term roadmap

Clicking this card should open a deeper Roadmap page.

## Strategic Roadmap

Source: `/Users/sun_mac_m1/Documents/LOVE STRINGS/Love Strings Roadmap.pdf`.

The long-term strategy is a 2026-2028+ roadmap with three major phases:

- Phase 1: English Covers / Love Strings brand formation
- Phase 2: Russian Covers
- Phase 3: Original Songs

High-level direction:

- 2026: launch Love Strings, establish market presence, build the first catalog and audience signals.
- 2027: grow to 15-30 releases, strengthen YUL/DIM/DUO identity, expand into Russian-language covers.
- 2027-2028: begin original material and campaigns.
- 2028+: build catalog plus originals, with originals becoming the main long-term asset.

The roadmap should be visible on the main dashboard as a compact status strip, not as a static PDF. The daily view should answer: where are we now, what milestone is next, are we on track, and what today matters strategically?

## Main Sections

### Production

Tracks the song pipeline and production process.

Expected content:

- Song list
- Release order
- Style notes
- Vocal lead
- Release date
- Production status
- Drums, piano, violin, demo readiness
- Demo time and BPM
- Missing assets or blockers
- Full production task list per song

Current source: `PRODUCTION` tab in `Love Strings ADMIN.xlsx`.

### Marketing

Tracks release planning, content production, and execution.

Expected content:

- Release/media calendar
- Instagram content plan
- YouTube content plan
- Platform-specific posting schedule
- Content assets needed
- Scheduled vs posted status
- Campaign checklist per song
- Drill-down views per platform

Current source: `RELEASE MEDIA PLAN` tab in `Love Strings ADMIN.xlsx`.

### Budget

Tracks project financial health.

Expected content:

- Income from live shows, weddings, events, and future monetization
- Spend on production, marketing, tools, licenses, distribution, photoshoots, etc.
- Balance
- Profit/loss by month
- Profit/loss by release cycle
- Upcoming expected costs
- Upcoming expected income

Current source: `BUDGET` tab in `Love Strings ADMIN.xlsx`.

### Platforms

Tracks music and social platform performance.

Expected content:

- YouTube views, watch time, subscribers, top videos, traffic sources
- Spotify listeners, streams, saves, playlist adds, countries/cities
- Instagram followers, reach, engagement, profile visits, post/reel performance
- TikTok, Apple Music, Deezer, Amazon Music, YouTube Music, website analytics later
- Manual stats entry first, API integrations later

### Sprints

Tracks the 2-3 week release cycles.

Expected content:

- Sprint name
- Sprint dates
- Target song/release
- Sprint goals
- Planned tasks
- Completion percentage
- Blockers
- Retrospective notes
- Lessons to repeat or avoid next release

### Backlog

Tracks future work.

Expected content:

- Future songs
- Content ideas
- Marketing experiments
- Booking opportunities
- Automation ideas
- AI agent ideas

### Roadmap

Tracks long-term strategic progress.

Expected content:

- Phase timeline from 2026 to 2028+
- Current phase and phase status
- Milestone progress
- Release-count targets
- English covers, Russian covers, and originals split
- Strategic objectives per phase
- Risks and blockers
- Links to related sprints, releases, platform growth, and budget status

## Current Workbook Inputs

Workbook path used in the first analysis:

`/Users/sun_mac_m1/Documents/LOVE STRINGS/Love Strings ADMIN.xlsx`

Relevant tabs:

- `PRODUCTION`
- `RELEASE MEDIA PLAN`
- `BUDGET`

Initial observations:

- `PRODUCTION` contains the song production pipeline, release dates, production readiness, instrumentation status, demos, BPM, and metadata notes.
- `RELEASE MEDIA PLAN` contains daily release and content planning from April through July 2026, with Instagram, YouTube, release milestones, and genre/positioning notes.
- `BUDGET` contains a simple cash log with spending, earnings, and balance.

## MVP Direction

Start with a practical MVP before adding platform APIs.

MVP should include:

- Responsive web app for desktop and mobile
- Main summary dashboard
- Production page using imported workbook/bootstrap data
- Marketing/release calendar page using imported workbook/bootstrap data
- Budget page using imported workbook/bootstrap data
- Own database for historical project data
- Manual platform stats entry first, stored in the database
- Drill-down navigation from summary cards into detailed sections

Later versions should add:

- YouTube Data API / YouTube Analytics API
- Spotify data import or available API/export workflow
- Instagram Graph API
- TikTok analytics import if accessible
- Website analytics
- Distributor reports
- AI backend agents for recurring work

Initial technical direction:

- App stack: Next.js / React
- Hosting target: Vercel free tier
- Database/auth target: Supabase free tier / PostgreSQL
- Excel and Google Sheets should be treated as import/bootstrap sources, not the long-term system of record
- Dashboard should read from the database
- External APIs should feed selected daily snapshots into the database over time

Reasoning:

- Free to prototype
- Beginner-friendly deployment path
- Professional enough for a portfolio/corporate proof case
- Supports historical tracking across platforms and business activity
- Creates a future-proof base for AI agents and automations

## Design Direction

The app should feel like a focused executive/operations dashboard, not a marketing landing page.

Priorities:

- Fast daily scanning
- Clear current priorities
- Mobile usability
- Drill-down only when needed
- Compact cards and tables
- Strong status colors for done, planned, blocked, overdue
- Calendar and task views that support release-cycle execution

## Open Questions

- What tech stack should be used for the first app version?
- Who needs access besides the project owner?
- Should authentication be simple password protection first, or proper login from the beginning?
- What are the exact task templates for each song release?
- Which metrics should define a successful release sprint?
- Which platform integrations should be prioritized first?

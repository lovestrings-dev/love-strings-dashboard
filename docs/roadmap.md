# Love Strings Strategic Roadmap

Source file:

`/Users/sun_mac_m1/Documents/LOVE STRINGS/Love Strings Roadmap.pdf`

## Dashboard Purpose

The roadmap should not be shown as a static PDF on the main dashboard. It should be transformed into a compact, live strategic status section that helps answer daily:

- Where are we on the long-term Love Strings roadmap?
- Which phase are we currently in?
- What milestone is next?
- Are we on track, at risk, or delayed?
- Which daily tasks support the long-term strategy?

## App Product Roadmap

This app roadmap is separate from the Love Strings music/business roadmap below.

### Version 1.0 - Internal Operating Dashboard

Target meaning:

- A practical private app for Dmitrii and Yuliia to run Love Strings work.
- Includes platform stats, marketing campaigns, production planning, budget, roadmap, shows, and daily focus.
- Still optimized for internal use, not public onboarding.

Major remaining areas:

- Platform integrations: Spotify parked, Deezer to investigate, Amazon Music to investigate, website/Google statistics to investigate.
- Dashboard: estimated total audience, deeper In Focus logic, and section polish after more modules become data-backed.
- Marketing: add "update Apple Music" default tasks to the first and last campaign day.
- Platforms: add more platform evolution views, audience evolution, and remaining connectors.
- Production: Supabase-backed in Beta 1.3; next step is deadline-risk warnings against Marketing release dates.
- Events: next Beta 1.5 focus is Supabase wiring for event records, Location Address Book records, location dropdown/autofill, and event-linked Budget lines.
- Budget: functional local/generated logic exists; next step is Supabase schema/wiring after Event and Production sources are stable.
- Roadmap: make strategic plan live and trackable.
- Other tasks: define a home for non-marketing/non-production work.
- UI: tidy and mobile-polish after core workflows are in place.

Next beta step:

- Beta 1.5 should release the fully functional Events module plus the smaller verified improvements added after Beta 1.4: floating scroll assist, Events protected delete flow, campaign-level Marketing budget lines, and active-campaign-day scroll.

### Version 2.0 - Voice-Controlled Assistant Layer

Target meaning:

- Let Dmitrii manipulate app data through natural voice or dictated instructions.
- Voice should create and update real app records, not just store loose notes.

Example voice outcomes:

- New concert record created from spoken date/location.
- New Reel idea added to a campaign.
- Production task marked done by voice.

### Version 3.0 - Adaptable Tool For Other Musicians

Target meaning:

- If public storytelling creates demand, adapt the internal Love Strings app into a setup-light tool for other independent musicians.
- Requires multi-user/product thinking: onboarding, configuration, permissions, templates, and safer data separation.

## Main Dashboard Roadmap Card

Recommended compact card content:

- Current phase
- Current milestone
- Progress bar toward milestone
- Next milestone
- Strategic health: on track, at risk, or delayed
- Today's strategic relevance

Example:

```text
Strategic Roadmap
Current Phase: Phase 1 - English Covers
Current milestone: 5 releases by Oct 2026
Progress: 4 / 5 releases
Next milestone: 10 releases by Jan 2027
Next strategic shift: Russian covers begin Jan 2027
Long-term target: 35+ releases by 2028+
```

## Main Roadmap Phases

Current UI note:

- The Roadmap tab now has a first UI-only visual tracker based on `Love Strings Roadmap.pdf`.
- The top strip shows monthly roadmap boxes from April 2026 to January 2028, grouped by phase.
- Month boxes are green only when all planned releases in that month are released, yellow when partially released, and white while still planned.
- Phase 1 is currently modeled as 20 target releases: 4 released and 1 active/current release.
- Phase 2 is modeled as 10 Russian-cover releases, currently all planned.
- Phase 3 is modeled as 5+ original-song releases toward the 35+ release target, currently all planned.
- Later logic should replace these UI seed values with live release, production, and marketing status.

### Phase 1 - English Covers / Brand Formation

Approximate period:

- April 2026 - July 2027

Strategic meaning:

- Launch Love Strings.
- Build first English cover catalog.
- Establish YUL/DIM/DUO identity.
- Test audience response and platform traction.
- Create the first repeatable release process.

Roadmap details observed:

- Start project and publish first releases.
- Target around 5 releases in 2026 as the first milestone.
- Build toward 15-20 releases by 2027.
- Track listening, platform graphs, and audience geography.
- Use first data to understand what resonates.

Relevant dashboard measures:

- Release count vs target
- Current song sprint status
- Production completion
- Marketing execution
- Platform growth
- Audience response by song
- Budget impact per release

### Phase 2 - Russian Covers

Approximate period:

- January 2027 - December 2027

Strategic meaning:

- Expand catalog with Russian-language covers.
- Continue English covers in parallel.
- Strengthen catalog volume and audience identity.

Roadmap details observed:

- Approximately 10 known Russian-language songs.
- Parallel English cover continuation.
- Goals include first Russian cover, new Russian audience, two-language catalog, stronger social and YouTube presence, and 25-30 releases in catalog.

Relevant dashboard measures:

- Russian cover release count
- English vs Russian catalog split
- Audience geography/language response
- YouTube performance
- Social growth
- Release consistency

### Phase 3 - Original Songs

Approximate period:

- Summer 2027 onward

Strategic meaning:

- Begin original Love Strings material.
- Shift from cover-led growth toward owned long-term assets.
- Build original campaigns and IP/master ownership.

Roadmap details observed:

- Start original material in summer 2027.
- Covers plus originals continue together.
- Goals include first original Love Strings single, first original music campaign, balance of covers and originals, owned masters/IP.

Relevant dashboard measures:

- Original song count
- Original campaign readiness
- Original vs cover performance
- Cost per original release
- Long-term asset ownership status

## Long-Term Milestones

Roadmap milestones observed:

- July 2026: Love Strings launched and represented publicly.
- October 2026: 5 releases.
- January 2027: 10 releases.
- April 2027: 15 releases.
- July 2027: 20 releases.
- October 2027: 25 releases.
- January 2028+: 30 releases.
- 2028+: catalog from covers and originals, originals become the main long-term Love Strings asset.
- 2028+: 35+ releases.

## Main Dashboard Display Recommendation

Show the roadmap as a horizontal phase strip:

```text
[Phase 1: English Covers] ---- [Phase 2: Russian Covers] ---- [Phase 3: Originals]
      Active now                    Starts Jan 2027                 Starts Summer 2027
```

Each phase card should include:

- Target date range
- Goal release count
- Current progress
- Main strategic objective
- Current risks/blockers
- Next 1-3 actions

## Detailed Roadmap Page

Clicking the main dashboard roadmap card should open a full Roadmap page with:

- Full 2026-2028+ timeline
- Phase details
- Milestone dates
- Release count progress
- English covers / Russian covers / originals split
- KPI targets per phase
- Retrospective notes
- Links to related songs, sprints, campaigns, and budget records

## Data Needed Later

To make the roadmap live rather than static, the app should calculate:

- Release count by date
- Release count by category: English cover, Russian cover, original
- Current phase based on date and release type
- Milestone progress based on target dates
- Release pace: actual vs planned
- Strategic health status
- Related active sprint and next tasks

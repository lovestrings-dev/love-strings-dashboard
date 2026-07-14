# Build Story Log

Purpose: preserve the Love Strings Dashboard build as a story that can later become Instagram Reels, Shorts, captions, and behind-the-scenes posts.

This file is written for storytelling first, not engineering precision. Keep it understandable for independent musicians who are curious about building useful tools with AI.

## Story Rules

- Use simple language and explain what changed in the musician workflow.
- Track platforms touched, because setup work on GitHub, Supabase, Vercel, YouTube, Instagram, and Meta is part of the story.
- Keep approximate time even when exact time is unavailable.
- Separate what Dmitrii did manually from what Codex helped design or implement.
- Prefer story beats that can become short clips: problem, action, result, lesson.
- Before changing a visible app module, capture two "before" screenshots: desktop/browser and mobile.
- When project files are updated after UI changes, or backend changes that affect a UI element, capture two matching "after" screenshots.

## Screenshot Capture Rule

For every module/tab we touch, save visual proof before development starts and after the visible result is ready.

Naming pattern:

- `docs/story-assets/screenshots/<module>/<yyyy-mm-dd>-<module>-before-desktop.png`
- `docs/story-assets/screenshots/<module>/<yyyy-mm-dd>-<module>-before-mobile.png`
- `docs/story-assets/screenshots/<module>/<yyyy-mm-dd>-<module>-after-desktop.png`
- `docs/story-assets/screenshots/<module>/<yyyy-mm-dd>-<module>-after-mobile.png`

Use these screenshots later as before/after material for Reels, Shorts, captions, and behind-the-scenes explanations.

Current screenshot archive:

- Dashboard before development snapshot, 2026-07-06: [desktop](story-assets/screenshots/dashboard/2026-07-06-dashboard-before-desktop.png), [mobile](story-assets/screenshots/dashboard/2026-07-06-dashboard-before-mobile.png).
- Full app current-state snapshot, 2026-07-07:
  - Dashboard: [desktop full page](story-assets/screenshots/dashboard/2026-07-07-dashboard-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/dashboard/2026-07-07-dashboard-current-mobile-fullpage.png)
  - Marketing: [desktop full page](story-assets/screenshots/marketing/2026-07-07-marketing-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/marketing/2026-07-07-marketing-current-mobile-fullpage.png)
  - Production: [desktop full page](story-assets/screenshots/production/2026-07-07-production-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/production/2026-07-07-production-current-mobile-fullpage.png)
  - Platforms: [desktop full page](story-assets/screenshots/platforms/2026-07-07-platforms-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/platforms/2026-07-07-platforms-current-mobile-fullpage.png)
  - Budget: [desktop full page](story-assets/screenshots/budget/2026-07-07-budget-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/budget/2026-07-07-budget-current-mobile-fullpage.png)
  - Roadmap: [desktop full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-current-desktop-fullpage.png), [mobile full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-current-mobile-fullpage.png)
- Production module before/after prototype, 2026-07-07:
  - Before: [desktop full page](story-assets/screenshots/production/2026-07-07-production-before-desktop-fullpage.png), [mobile full page](story-assets/screenshots/production/2026-07-07-production-before-mobile-fullpage.png)
  - After: [desktop full page](story-assets/screenshots/production/2026-07-07-production-after-desktop-fullpage.png), [mobile full page](story-assets/screenshots/production/2026-07-07-production-after-mobile-fullpage.png)
- Budget module before/after prototype, 2026-07-07:
  - Before: [desktop full page](story-assets/screenshots/budget/2026-07-07-budget-before-desktop-fullpage.png), [mobile full page](story-assets/screenshots/budget/2026-07-07-budget-before-mobile-fullpage.png)
  - After: [desktop full page](story-assets/screenshots/budget/2026-07-07-budget-after-desktop-fullpage.png), [mobile full page](story-assets/screenshots/budget/2026-07-07-budget-after-mobile-fullpage.png)
- Roadmap module before/after prototype, 2026-07-07:
  - Before: [desktop full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-before-desktop-fullpage.png), [mobile full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-before-mobile-fullpage.png)
  - After: [desktop full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-after-desktop-fullpage.png), [mobile full page](story-assets/screenshots/roadmap/2026-07-07-roadmap-after-mobile-fullpage.png)

Capture note:

- The 2026-07-07 screenshots were recaptured after waiting for Supabase-backed campaign and platform data to load. Desktop screenshots now show the settled app state. Mobile full-page screenshots preserve the current mobile state, including visible layout overflow/compression in some sections. Treat this as useful "before" evidence for the later UI tidy-up pass.
- Mobile scroll GIFs were also captured for Dashboard and Marketing on 2026-07-07. The preferred versions are the bottom-reaching slower GIFs, which explicitly reach the end of each page and pause there. Earlier partial GIFs are kept only as intermediate artifacts.
- A separate Marketing mobile scroll GIF was captured with the Rock and Roll campaign opened first, so the story archive includes a clearer view of the daily campaign planner in action: [Marketing expanded campaign mobile scroll](story-assets/videos/mobile-scroll/2026-07-07-marketing-details-mobile-scroll.gif).
- Production before/after screenshots show the shift from a placeholder/fallback tab to a real rough production tracker: song cards, production deadline, progress boxes, next unfinished tasks, expandable production steps, notes, and local Add song/Add production step controls.
- The Production tracker was then re-seeded from `Love Strings ADMIN.xlsx`, sheet `PRODUCTION`, turning the placeholder song list into 27 workbook-based song cards ordered by the planned production/release flow.
- Budget before/after screenshots show the shift from a placeholder/fallback tab to a first finance tracker: total earned, total spent, current balance, potential future earn, upcoming balance, and an editable local ledger seeded from the workbook `BUDGET` tab.
- Roadmap before/after screenshots show the shift from a single placeholder progress bar to a three-phase visual tracker based on the attached Love Strings roadmap: monthly progress boxes, phase separators, release boxes, and phase cards for English covers, Russian covers, and originals.

## Current Story Arc

Working theme:

An independent musician is building a custom dashboard for the real work around releases: platform stats, campaign tasks, production planning, and daily decision-making.

Audience framing:

- This is not just "coding an app".
- This is learning how to build small custom business tools around a real creative project.
- The dashboard gradually turns scattered platform dashboards, spreadsheets, and manual notes into one shared workspace.

## Origin Story

The first chat did not start with code. It started with Dmitrii saying he was new here, had an executive dashboard to build, and did not know where to start or how to provide enough information.

The first useful shift was to treat the project not as a generic executive dashboard, but as the operating system for Love Strings: a real independent music project with releases, social platforms, shows, content planning, production tasks, and budget pressure.

Early discovery:

- Love Strings is a Vienna-based music/live project with public website and platform presence.
- Public information helped identify likely dashboard areas: bookings, audience growth, content performance, streaming performance, and marketing funnel.
- Private analytics would need exports, screenshots, APIs, or owner-account access later.
- The first real data source was the Love Strings admin workbook / Google Sheet, especially:
  - `PRODUCTION`
  - `RELEASE MEDIA PLAN`
  - `BUDGET`

The most important early product decision:

Start with a practical MVP based on existing workflow data before chasing every API.

Story angle:

"I did not start by knowing how to build an app. I started by showing the real messy places where the work already lived: production notes, release media plans, budget sheets, and platform dashboards."

## Timeline Beats

| Day / Session | Approx. Time | Main Actions | Platforms / Tools | Story Angle |
| --- | ---: | --- | --- | --- |
| Day 0 / First orientation | 0h 07m tracked from exported chat | Introduced Love Strings, clarified that the app should support a real music project, and identified public/private data boundaries. | Codex, Love Strings website, public platform research | "Before writing code, we had to translate a music project into an operating dashboard." |
| First source-data planning | 0h 02m tracked from exported chat + later workbook analysis | Chose the existing Love Strings admin workbook / Google Sheet as the starting point, especially Production, Release Media Plan, and Budget. | Google Sheets, Excel workbook, Codex | "The dashboard started from the places where the work was already happening." |
| First build session | 1h 42m | Turned rough dashboard idea into an early working prototype. Defined the first modules and infrastructure direction. | Codex, local Mac, Next.js, GitHub, Supabase | "I started with a rough idea and, in under two hours, had the first working version of a musician dashboard." |
| Infrastructure setup | Earlier TBD | Created GitHub account/repo, connected Supabase, set up CLI access, and prepared cloud-backed app data. | GitHub, Supabase, Terminal, Codex | "Before the app became useful, we had to give it a real memory and a place to live." |
| Marketing module build | Earlier TBD + 0h 45m tracked | Built the campaign tracker with release dates, daily tasks, progress bars, editable campaign cards, album art URLs, and dashboard previews. | Next.js, Supabase, Cloudinary | "The app started to understand how a music release campaign actually works: daily videos, uploads, progress, and release dates." |
| Platform metrics connection | 2h 14m + earlier TBD | Connected YouTube and Instagram API importers, tested latest Short/Reel stats, added 30-day reach/views, and stored daily metric snapshots in Supabase. | YouTube API, Instagram API, Meta Developers, Supabase | "Instead of checking every platform manually, the app began collecting the numbers itself." |
| YouTube Music connection | 0h 20m tracked | Found that the YouTube Music artist page is available as a Topic channel through the existing YouTube Data API and added it to the collector plan. | YouTube Music, YouTube Data API, Supabase | "One more platform moved from manual checking into the dashboard's daily memory." |
| Spotify connection | 0h 20m tracked | Added the first Spotify Web API connection for artist followers and popularity score, while keeping exact stream counts as a later Spotify for Artists/export problem. | Spotify Developer Dashboard, Spotify Web API, Supabase | "We connected what Spotify allows publicly first, without pretending popularity is the same as streams." |
| Apple Music CSV import | 0h 35m tracked | Chose a practical manual-import model for Apple Music for Artists CSV exports: upload, parse once, save the numbers, discard the file. The deployed test worked. | Apple Music for Artists, CSV, Supabase | "Apple Music would not just hand us the data by API, so we built a bridge: export CSV, upload once, keep the numbers, throw away the file." |
| First deployed beta | 0h 20m + earlier deployment time TBD | Published Beta 1.1 on Vercel, protected it with Basic Auth, verified the live refresh button, and made it usable outside the local computer. | Vercel, GitHub, Supabase | "The prototype became a real private web app that Yuliia could open too." |
| Daily autopilot setup | 0h 20m tracked | Added GitHub Actions scheduler for the protected daily 06:00 Europe/Vienna metrics refresh. Manual workflow test showed a green checkmark. | GitHub Actions, Vercel, Supabase | "The app now has its first autopilot habit: wake up every morning and update the platform stats." |
| Budget prototype | 0h 25m tracked | Built a UI-only Budget tab from the existing workbook data, with summary cards and an editable local ledger. | Excel workbook, Next.js, local storage | "The money part moved from a spreadsheet into the same dashboard, even before we connected it to the database." |
| Roadmap prototype | 0h 25m tracked | Turned the static Love Strings roadmap PDF into a UI-only three-phase tracker with monthly and release progress boxes. | Roadmap PDF, Next.js | "The long-term music plan stopped being just a picture and became something the app can gradually track." |
| Events prototype | 0h 30m tracked | Created an Events tab from the Love Strings website archive, with editable links and a future-looking Next event card. | Love Strings website, Next.js | "Shows became part of the same operating system: not just memories on the website, but upcoming work the dashboard can plan around." |
| Dashboard consolidation | 0h 50m tracked | Copied the most useful cards from Events, Marketing, Production, Budget, and Roadmap into Dashboard; compacted platform cards; moved Apple Music import to Platforms. | Next.js, Supabase-backed data, Apple Music CSV flow | "The dashboard stopped being a collection of stats and started feeling like the morning command screen for the whole music project." |
| Beta 1.2 control-center release | 0h 20m tracked + previous module work | Released the current dashboard-control-center concept, fixed the visible version label, and verified the live Vercel app now shows Beta 1.2. It gives a visible structure for how Marketing, Production, Platforms, Events, Budget, Roadmap, and Focus Queue should work together, while marking which modules still need real Supabase wiring. | GitHub, Vercel, Next.js, Supabase-backed pieces, prototype modules | "This was the moment the app became a map of the whole independent musician workflow, not just one useful tracker." |
| Beta 1.3 Production backend start | 0h 45m tracked | Started turning the Production tab from local prototype into shared app memory: normalized database tables, server-side save/delete route, Supabase loading, first-load seeding, and a better Add song default deadline. | Supabase, Next.js API routes, GitHub/Vercel release path | "The production plan stopped being only something my browser remembers and started becoming something the app itself can remember." |
| Beta 1.4 mobile and sharing release | 1h 20m tracked | Released the mobile/readability polish pass with the Love Strings logo, clickable platform profile links, compact metric cards, better mobile wrapping, and QR Codes dropdowns for Website, Dashboard, and music/social platforms. | Next.js, GitHub, Vercel, QR codes, mobile QA | "The dashboard became something I can open on my phone and use in conversation: show the numbers, show the plan, then let someone scan the exact link." |

## Reel Ideas From Current Build

### Reel 0: I Did Not Know Where To Start

Hook:

I wanted to build an app for my music project, but my first question was: where do I even start?

Beats:

- Show the original feeling: scattered sheets, platform dashboards, campaign notes.
- Explain that the first step was not coding; it was describing the real work.
- Show the three first source areas: Production, Release Media Plan, Budget.
- Explain the shift from "executive dashboard" to "daily operating system for an independent music project."
- End with: "The app started by organizing the chaos I already had."

### Reel 1: From Idea To Working App

Hook:

I wanted a dashboard for my music project, so I started building one with AI.

Beats:

- Show messy idea / notebook / dashboard need.
- Show the local app running.
- Show main tabs: Dashboard, Marketing, Platforms.
- Mention first build session: 1h 42m.
- End with: "This is what creative independence starts to look like now."

### Reel 2: The App Gets A Memory

Hook:

A dashboard is not useful until it remembers things.

Beats:

- Explain Supabase as the app's database in plain language.
- Show campaign data surviving refresh.
- Show album art URL saved.
- Explain local and online app read the same data.

### Reel 3: The App Starts Reading YouTube And Instagram

Hook:

Today the dashboard stopped being just manual notes.

Beats:

- Show YouTube / Instagram platform cards.
- Explain that APIs bring the numbers into the database.
- Mention latest video/Short/Reel and 30-day Instagram metrics.
- Explain daily snapshots: one photograph of the numbers per day.

### Reel 4: My First Deployed Beta

Hook:

I just deployed my first ever app.

Beats:

- Show Vercel deployment.
- Show Basic Auth login.
- Show live app opening.
- Show Refresh button returning `Updated 2 data collectors.`
- End with: "It is still beta, but it is real."

### Reel 5: Autopilot Morning Stats

Hook:

The dashboard now wakes up before I do.

Beats:

- Explain GitHub Actions as a scheduled robot.
- Explain 06:00 Europe/Vienna daily refresh.
- Show the green checkmark from the manual workflow test.
- Tomorrow's follow-up: confirm the automatic morning run.

### Reel 6: When Platforms Make Artists Work For Their Own Data

Hook:

Some platforms make it surprisingly hard for artists to use their own stats.

Beats:

- Show Apple Music for Artists with the CSV export idea.
- Explain simply: YouTube and Instagram can update automatically, Apple Music needs a downloaded file.
- Show the app's Import CSV button.
- Show the file being imported once.
- Show the dashboard numbers updating.
- Explain the rule: "We keep the numbers, not the file."
- End with: "Creative independence is not only making music. It is also building better ways to understand what happens after you release it."

Caption angle:

Not every platform gives independent artists a clean API. So instead of waiting for perfect automation, we built a small bridge: download the Apple Music CSV, upload it to our dashboard, save the useful numbers, and discard the file. Tiny workflow improvement, big feeling of control.

### Reel 7: The Dashboard Becomes A Command Screen

Hook:

At first, every tab in my app was separate. Then we asked: what do I need to see first thing in the morning?

Beats:

- Show the Dashboard with the most important modules copied into one view.
- Explain that the full details still live in their own tabs.
- Show compact platform stats.
- Show current/next marketing campaigns.
- Show current/next production songs and the expandable task list.
- Show budget balance and roadmap Phase 1.
- End with: "This is the moment it started feeling less like an app demo and more like a real work cockpit for the band."

Caption angle:

The breakthrough was not adding more screens. It was deciding what belongs on the first screen. For an independent musician, that means: next event, platform numbers, campaign progress, production tasks, budget, and long-term roadmap.

### Reel 8: Shows Join The Dashboard

Hook:

Live shows are not separate from releases. They affect money, content, audience, and planning.

Beats:

- Show the old Love Strings website/news archive as the source.
- Show historical events becoming editable records in the app.
- Show the `Next event` card.
- Explain days-left logic: if there is no future show, the app says no upcoming events planned yet.
- Connect it to future budget logic: event potential earn will feed upcoming balance.

Caption angle:

The app started with platform stats and release tasks. But for a real independent music project, live shows matter too. So we added an Events section: archive what happened, plan what comes next, and later connect shows to budget and content planning.

### Reel 9: The App Starts Understanding Money

Hook:

I wanted the app to stop being just a list of tasks and start helping with the real musician question: are we moving financially in the right direction?

Beats:

- Show the Events tab with a gig card.
- Explain that a live show can now have earned and spent values.
- Show how those values automatically appear in Budget as read-only rows.
- Explain the rule simply: edit the gig in Events; Budget shows the result.
- Show the Dashboard Budget strip with four compact cards: current balance, projected earn, projected spend, projected balance.
- Explain actual versus projected: "what already happened" and "what may happen next month."
- End with: "This is how a personal dashboard becomes a small decision-making system."

Caption angle:

For independent musicians, money information is usually scattered: one note for a gig fee, another receipt for expenses, another mental calculation before the next release. We connected Events to Budget so show income and expenses can feed the dashboard automatically. Still simple, still beta, but already more useful than a spreadsheet buried somewhere.

### Reel 10: When Separate Tabs Start Talking To Each Other

Hook:

At first, every tab was useful on its own. Then the app started becoming smarter: one piece of information could power several places.

Beats:

- Show Production as the place where a song starts: title, artwork, production steps, license, distributor.
- Show Marketing choosing a campaign song from the Production song list instead of typing a separate name.
- Show album art added once in Production and appearing in Marketing.
- Show Production costs flowing into Budget instead of being typed twice.
- Explain the rule simply: "Put the information where it naturally belongs. Let the app reuse it elsewhere."
- End with: "This is the difference between a collection of pages and a real operating system for a music project."

Caption angle:

One of the most satisfying moments in building this dashboard was connecting the modules. A song name belongs in Production first. Album art belongs there too. Campaigns can then use that song, and Budget can see the costs that production creates. For an independent musician, this means fewer repeated notes, fewer forgotten expenses, and a clearer picture of what is happening.

### Reel 11: The App Learns To Remember Production

Hook:

The Production tab stopped being a prototype on my laptop and became shared app memory.

Beats:

- Show Production song notes being edited.
- Refresh the app and show the note staying there.
- Explain simply: the Production plan now saves to the database, so it can survive reloads and later work online.
- Show a new song being created and staying in focus even when sorting moves it.
- Show Marketing offering the recently edited song first when creating a campaign.
- Explain the small UX lesson: if the app sorts things automatically, it also has to help the human keep their place.
- Mention the copyright moment: before publishing the next beta, we added a simple proprietary notice.

Caption angle:

Beta 1.3 was the moment the Production module became real app memory. Notes, deadlines, production steps, subtasks, artwork links, and production costs now save through Supabase instead of living only in the browser. We also fixed a very human problem: when lists sort automatically, the app should not make you hunt for the thing you were just editing.

### Reel: The Dashboard Became Shareable

Hook:

I wanted my music dashboard to be useful on my phone, not only on my laptop.

Beats:

- Show the Love Strings logo in the app header.
- Show platform cards with cleaner metric blocks.
- Tap the new QR Codes dropdown.
- Show QR cards for Website, Dashboard, Instagram, YouTube, music platforms.
- Explain simply: if someone asks where to listen or follow, the dashboard can become the link hub too.
- Show the mobile view as the real-life use case: open phone, show QR, another phone scans.
- Mention the next step: sync QR edits to the database so the same list appears for everyone using the app.

Caption angle:

Beta 1.4 was not about adding a huge new backend. It was about making the app feel usable in real life: cleaner on mobile, branded with the Love Strings logo, and ready to share links by QR code straight from the phone screen. Sometimes a dashboard is not only for looking at numbers. It can also become the place you use when someone asks, "Where can I find your music?"

### Reel: Events Become More Than A Calendar

Hook:

At first, the Events tab was just a list of gigs. Then it started becoming an address book, budget source, and memory of where the band has already played.

Beats:

- Show the Events archive with historical Love Strings appearances.
- Open the new Location Address Book.
- Explain simply: if we play the same venue again, we should not retype the same address, link, and contact notes every time.
- Show creating/editing an event and choosing a location from the dropdown.
- Show the location/address fields autofilling.
- Show the event Budget section with a reason and positive/negative amount.
- Show the generated Budget row in the Budget tab.
- Explain the rule: "Edit the event where the real thing happened; Budget reflects it."
- Mention the next beta: wire Events to Supabase so Dmitrii and Yuliia share the same event memory.

Caption angle:

For independent musicians, events are not only dates. They are venues, contacts, travel costs, income, memories, and future opportunities. The dashboard started turning the Events tab into a small band CRM: where we played, who to contact, what it cost, what we earned, and what should appear in the Budget automatically.

### Reel: Campaigns Start Tracking Money Too

Hook:

Marketing is not free, even when you do most of it yourself.

Beats:

- Show a Marketing campaign card.
- Open campaign details and show the new Budget section under the progress bar.
- Explain that campaign expenses can be entered directly inside the campaign.
- Use examples: ads, photoshoot, travel, props, promo tools.
- Show the generated Budget row.
- Explain the product idea: campaign progress and campaign spending should live close together.
- End with the thought: "A useful app is not just a pretty dashboard. It helps you notice what every creative decision costs."

Caption angle:

We added campaign-level budget lines to the Marketing tab. The idea is simple: if spending belongs to a release campaign, record it inside that campaign and let Budget collect the financial picture. This is still beta logic, but it is exactly how the app starts becoming useful in real creative work.

## Open Story Details To Fill Later

- Exact first-session date.
- Better split of the early `1h 42m` between architecture, infrastructure, and UI.
- Screenshots or screen recordings from Vercel, Supabase, GitHub Actions, and the app.
- Dmitrii's spoken reflections: what felt surprising, confusing, or exciting.
- Yuliia's first feedback after opening the deployed beta.

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

### Reel: The Autopilot Finally Woke Up

Hook:

Automation sounds simple until you need it to work every morning.

Beats:

- Show the Dashboard platform stats and the idea: the app should collect one daily "photo" of the numbers automatically.
- Explain that we first placed the scheduler in GitHub Actions.
- Show the real problem in plain language: it sometimes waited in a queue, ran late, skipped, or did not create the morning snapshot.
- Mention that for several days we checked logs, adjusted times, widened the schedule window, and kept manual refresh as a fallback.
- Show the decision: move the scheduler to Vercel, closer to where the app already lives.
- Show the successful Supabase snapshot for 2026-07-15, imported around 07:04 Vienna time.
- Explain the outcome: Instagram, YouTube, and YouTube Music numbers appeared without pressing the Refresh button.
- End with: "This was the moment the app got its first real autopilot habit."

Caption angle:

One of the funniest parts of building the dashboard was automation. We thought: just run the collectors every morning. Easy, right? First we placed the scheduler in GitHub Actions, then spent several days dancing around delays, skipped runs, timing windows, and manual fallbacks. Finally we moved the scheduler to Vercel, where the app itself lives. And then it happened: the platform numbers appeared in Supabase automatically. Not glamorous, but very satisfying.

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

### Reel: The First Module Was Already Useful

Hook:

The app did not become useful only when it was "finished." The Marketing module started being useful first.

Beats:

- Show the Marketing tab with campaign cards, release dates, progress boxes, and daily tasks.
- Explain that this was the first module that became truly operational.
- Show that while Dmitrii and Codex continued building Production, Events, Budget, Platforms, and Roadmap, Yuliia could already use the Marketing tracker for daily campaign work.
- Emphasize the product lesson: you do not need the whole app finished before one part starts creating value.
- Show the Dashboard campaign preview pulling the Marketing campaign state into the daily command screen.
- End with: "The app was growing while already being used."

Caption angle:

One of the most encouraging moments was realizing that the app did not have to be complete to be useful. Marketing became the first working module: campaign dates, daily content tasks, upload status, and progress. While we kept developing the rest of the system, Yuliia could already use this part in daily Love Strings work. That changed the feeling of the project from "prototype" to "real tool in progress."

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

## Storytelling Release Pattern

Use the same rhythm as the product beta strategy:

- One beta = one main functional module or capability.
- Also mention the smaller fixes and UI lessons discovered in real use.
- Keep the audience-facing language practical: "we added the main thing, then real testing showed what needed cleanup."

Examples:

- Beta 1.5: Events became shared app memory; the real-use cleanup includes safer event delete flows, address book behavior, and event money feeding Budget.
- Beta 1.6: Budget becomes the headline module; the cleanup includes the Address Book persistence fix and other small issues found after Beta 1.5.

### Reel: The App Learns Money Properly

Core story:
- Budget started as a useful local prototype: totals, recurring costs, event income, production costs, and campaign costs were visible, but the editable ledger was still mostly browser memory.
- For Beta 1.6, we gave Budget its own Supabase-backed memory so Dmitrii and Yuliia can work from the same financial picture.
- The smart part is that the app does not store every generated line as duplicate data: Event, Production, Marketing, and recurring rows stay connected to their source logic.
- We tightened the rule after testing: Event, Production, and Marketing money lines should be corrected in their source module, not hidden inside Budget, because hiding source rows can distort analytical cards.
- Recurring forecast rows are the exception: they can still be hidden from Budget when a future expected payment will not happen.

Short script:
- "At first, Budget was just a local finance tracker inside the dashboard."
- "Then Events, Production, and Marketing started creating money lines automatically."
- "For Beta 1.6, we connected the Budget itself to the database."
- "Now the app can remember real ledger edits, projected costs, recurring payments, and cleanup choices across devices."

Shot ideas:
- Show the Budget summary cards.
- Add a manual Budget line and refresh.
- Show a generated row from Events or Production and explain that the source module remains the source of truth.
- Show the app as a shared working tool, not just a spreadsheet replacement.

Follow-up story angle:
- The next Budget idea became real: stop looking only at the total balance and start asking where the money comes from.
- Three practical buckets make sense for Love Strings: Events, Production, and Marketing.
- Events are usually the main earning source, but they can also have travel or venue-related costs.
- Production is where release costs and tools like SUNO belong.
- Marketing includes campaign spends, ads, Canva, and promotion costs, including promotion linked to events.
- This turns Budget from a ledger into a simple business mirror: are shows funding the project, are releases costing what we expected, and how much are we investing in attention?
- First implementation step: Budget now has source buckets, six analytical cards, and a manual bucket selector.
- Post-release reality beat: one manual Budget delete bug was found after Beta 1.6 was already live, so we decided not to hotfix the released version and instead carry the fix into the next beta. This is a useful story point: a beta is not a promise that nothing breaks; it is a controlled rhythm for learning from real use.

Short script add-on:
- "Once the money was finally stored properly, the next question became more interesting."
- "Not just: are we positive or negative?"
- "But: where does the money come from, and where does it go?"
- "For musicians, that means three buckets: shows, production, and marketing."
- "And then real use did what real use always does: it found the next small bug."
- "We left the released beta stable and moved that fix into the next beta."

### Reel: When One Number Taught Us To Name Data Properly

Core story:
- We added a new YouTube metric and at first it looked wrong: the app showed about 17.8K views while YouTube Studio showed about 1.4K.
- The bug was not that the API was broken. The API was giving lifetime channel views, while the Studio table Dmitrii was looking at was a selected-period total.
- The fix was partly technical and partly language: rename the metric to `Lifetime Views`, remove invented historical rows, and rebuild the history from the current API total plus real YouTube Studio daily deltas.
- This is a useful creator-tech lesson: the dashboard is only as honest as the names of its metrics.

Short script:
- "Today the app gave me a number that looked completely wrong."
- "YouTube Studio said 1.4K views. Our app said 17.8K."
- "Turns out both were right. One was a period view, one was lifetime channel views."
- "So we fixed the app, not by hiding the number, but by naming it correctly."

Shot ideas:
- Show the YouTube card with `Lifetime Views`.
- Show the graph after cleanup.
- Show the moment of confusion as a caption: "Wrong data? Or wrong label?"
- End with: "Building your own tool means you also learn what your numbers really mean."

### Reel: Tiny Daily Change Numbers

Core story:
- Platform cards started as static totals: followers, subscribers, plays, views.
- The next improvement was small but meaningful: add daily change values like `(+3)` or `(-1)` beside the main number.
- Green means growth, red means decline, muted means no change.
- For Apple Music, because updates come from manual CSV uploads, the comparison is latest available snapshot versus previous available snapshot rather than yesterday.

Short script:
- "A total number tells you where you are."
- "A tiny daily change tells you if you are moving."
- "So we added the small numbers beside the big ones."
- "It is not a huge feature, but it makes the dashboard feel alive."

### Reel: The Focus Queue Becomes Actionable

Core story:
- Focus Queue started as a simple list of what matters next.
- Then it became more practical: each task can now open its status choices directly from the Dashboard.
- Marketing tasks can be Not started, In progress, Done, or Irrelevant.
- Production tasks keep the production status model.
- Other tasks became a small memory drawer inside Focus Queue rather than a full app tab.
- The compact view shows one Marketing task, one Production task, and up to three active Other tasks.
- The expanded view manages the remaining active Other tasks and keeps completed/irrelevant tasks in hidden history.
- We intentionally leaned away from deletion: an idea that is irrelevant today may become useful later.

Short script:
- "The dashboard should not only tell me what to do."
- "It should let me update the work without hunting through tabs."
- "So Focus Queue started becoming a control surface."
- "Small buttons, source-linked statuses, and fewer taps on mobile."

Storytelling add-on:
- "Not every task deserves a whole project board."
- "Sometimes it is just: book a photoshoot, remember an idea, update one small thing."
- "So instead of building another tab, we made Focus Queue remember those small things."
- "Done tasks disappear from the daily view, but the app still remembers them."
- "That matters because creative work is full of ideas that look irrelevant today and useful tomorrow."

Beta-release beat:
- We intentionally stopped before wiring Other Tasks to Supabase.
- The local workflow now feels right: quick add, compact active list, history instead of deletion, and editing without losing mobile focus.
- Tomorrow's job is to make this shared across devices and users.
- This is a useful product-build story: first make the habit feel natural, then make it permanent and shared.
- Beta 1.7 also became a "small wins add up" release: platform graphs got a shared visual language, the dashboard got benchmark targets, Events got poster thumbnails, and the app header started showing today's date like a daily command screen.
- Before release prep, we checked that the production benchmark logic fits the real records: every current song still starts with Demo as the earliest step, so existing-demo songs can fairly count from the next production step.

Short script add-on:
- "Today we solved one of the least glamorous parts of music life: all the small things that do not fit anywhere."
- "Book the photoshoot, remember a post idea, check one admin task."
- "We tested it locally inside the Focus Queue first."
- "Tomorrow we make it shared, so it becomes real app memory."
- "We also added a musician-style benchmark: not just what is next, but what record am I trying to beat?"

Viewer-series connection:
- This episode should connect back to the earlier Marketing-module story: Yuliia was already using the app daily while the rest of the system continued growing around it.
- The viewer should feel that each beta is not random feature stuffing. Each beta answers a musician-life problem:
  - Marketing: "How do we promote a release every day without losing track?"
  - Production: "How do we know what song is really next?"
  - Events: "How do gigs and locations become reusable memory?"
  - Budget: "How do money lines stop being scattered?"
  - Platforms: "How do daily stats become visual momentum?"
  - Focus Queue: "Where do all the small tasks go?"
- Keep showing Dmitrii's testing inputs as part of the story, not as interruptions: "I tried it on mobile", "Yuliia noticed the screen jumping", "the first scheduler was unreliable", "we moved the scheduler", "we found duplicates", "we cleaned them up". The audience should see that useful software is shaped by real use.
- Today contained a strong "near autopilot" moment: generated Budget lines, platform snapshots, and Focus Queue reminders are starting to feel like the dashboard actively helps instead of just storing notes.

Possible short/reel structure for Beta 1.7:
1. Hook: "Today the dashboard started feeling less like a spreadsheet and more like a control room."
2. Show platform graphs: "Numbers became curves, not just cards."
3. Show Budget graphs/ledger: "Expenses and income started explaining themselves."
4. Show Focus Queue: "The tiny tasks finally got a home."
5. Show Events poster and benchmarks: "Even posters and personal records became part of the workflow."
6. Honest beta note: "One rare add-task behavior is still on the watch list, and tomorrow we wire Other tasks to the database."
7. Close: "This is how a musician's private tool becomes useful one tested habit at a time."

### Reel: Irrelevant Is A Real Status

Core story:
- In a real release campaign, not every piece of content belongs on every platform.
- A video may be useful for Instagram but not for YouTube, or the other way around.
- Before this, those tasks looked unfinished forever.
- Adding `Irrelevant` made the campaign progress more honest: if a platform upload does not apply, it should not punish the completion percentage.

Caption angle:

Sometimes better software is not about adding more automation. Sometimes it is about adding one word that describes real life.

### Reel: Beat Yesterday, Not Everybody

Core story:
- Focus Queue gained a daily target: complete at least three useful tasks.
- Done earns two points, In progress earns one, and Irrelevant does not distort the score.
- Three completed tasks equal 100%, but a strong day can go beyond 100% instead of being capped.
- The app stores each day's score in Supabase so daily consistency can become an evolution graph later.
- This connects three personal benchmarks: daily Focus momentum, best Marketing campaign completion, and fastest Production cycle.

Autopilot story add-on:
- Apple Music cannot currently give the app the same automatic daily data feed as YouTube and Instagram, so the app watches the date of the latest manual CSV import.
- When the Apple data is more than seven days old, or a new Marketing campaign begins, Focus Queue creates an Apple Music update reminder.
- Dmitrii opened Platforms and imported the new Apple Music CSV at the real source of the work.
- The app recognized that action, marked the Focus reminder Done, removed it from the active queue, and awarded two daily-progress points without asking for a second manual status update.
- After a large historical campaign reconstruction temporarily inflated the daily score, we reset only that day's `focus_daily_progress` snapshot while preserving every real Marketing status.
- This is the moment Focus Queue stopped feeling like another to-do list: it detected work, watched the source module, and rewarded completion automatically.

Short script add-on:
- "My dashboard reminded me that Apple Music data was getting old."
- "I did the real job once: uploaded the CSV in Platforms."
- "The reminder completed itself, disappeared from Focus Queue, and gave me two points."
- "That tiny loop is what I mean by building an assistant, not another list."

Viewer-series connection:
- Earlier episodes show the daily target and the rule that Done earns two points.
- This scene proves the points can come from real actions elsewhere in the app, not only from pressing status buttons.
- It also gives an honest correction beat: importing months of historical work should not count as today's productivity, so the daily snapshot was reset without erasing the reconstructed history.

### Reel: The Progress Bar That Forgot After Refresh

Core story:
- The new daily Focus score looked correct until the page was refreshed.
- That exposed the difference between optimistic UI and real persistence: a feature is not finished because the screen changed once.
- We traced the save path, corrected the protected API flow, and retested Marketing release-day tasks and Focus progress after refresh.
- Dmitrii's test was the acceptance criterion: change it, refresh it, and make sure the same truth comes back.

Short hook:
- "The feature worked perfectly, until I refreshed the page."
- "That is how a nice-looking prototype tells you it is not a real tool yet."

### Reel: One Failed Task Nearly Reset A Campaign

Core story:
- Adding new standard release-day tasks exposed a dangerous save sequence: old campaign days could be removed before a new task failed validation.
- The visible symptom was frighteningly simple: Rock and Roll came back with tasks reset to Not started.
- We changed the database operation into one atomic transaction and deliberately sent a bad task to test the rollback.
- The failed save was rejected and all 14 campaign days remained intact.

Short hook:
- "We did not test only the happy path. We tried to break the campaign on purpose."
- "Now either the whole campaign saves, or nothing changes."

Story lesson:
- Database safety is not abstract infrastructure. It protects hours of real work entered by Yuliia and Dmitrii.
- This is a strong continuation of the story that Marketing was already used daily while the rest of the app was still being built.

### Reel: The QR Drawer Becomes A Shared Backstage Toolkit

Core story:
- The app already carried QR codes for the website, music platforms, and dashboard so Dmitrii could open one drawer and let someone scan the right destination.
- But edits lived only in one browser, which meant another phone or Yuliia's browser could show a different list.
- We moved the QR configuration into private Supabase storage while keeping local fallback for offline use and first migration.
- A tiny sharing feature became another example of the app turning from one person's prototype into a shared working tool.

### Reel: Tightening A Beta Without Changing Its Face

Core story:
- Some of the most important Beta 1.8 work is almost invisible: anonymous Marketing writes were removed, mutations moved behind protected server routes, and multi-step campaign saves became transactional.
- The app looks nearly the same, but the risk of an accidental or malformed write is much lower.
- Pair this with small visible polish: a stable Next-event loading state, consistent module dates, and compact dashboard layouts.

Series connection:
- Earlier episodes show features appearing quickly.
- This episode shows the second half of building: revisiting what already works, learning from real use, and making it trustworthy.

Short hook:
- "The dashboard is not asking me to beat another artist. It is asking: can I beat yesterday?"

### Reel: The Roadmap Stopped Being A Picture

Core story:

- The first Roadmap looked convincing, but it was still a manually arranged picture based on a PDF.
- We turned phases into database records and connected every song to a phase and release date.
- The month boxes now react to the real catalog: released, scheduled, missed, or not planned.
- Dmitrii created Phase 4 `Go on tour` from the app itself, proving the Roadmap can grow without another coding pass for every new phase.
- The result is not just a strategic overview; it is now a place to reorder the future.

Short hook:

- "Yesterday this roadmap was decoration. Today it can change the production plan."
- "I added a new phase to my music career from the app we built ourselves."

Series connection:

- Marketing was the first module Yuliia could use daily while the rest was still being built.
- Production made every song operational.
- Budget connected the costs and income.
- Roadmap now connects those working modules to the longer Love Strings story.

### Reel: One Date, Three Modules

Core story:

- A song's release date appeared in Production, Marketing, and Roadmap, which created three opportunities for the plan to disagree with itself.
- We made release date one shared fact and treated it as the final Production step.
- Moving it in either Production or Marketing now updates all three places and shifts every Marketing campaign day.
- The first version exposed a duplicate-date database constraint; instead of hiding the error, we changed the shift into one collision-safe operation and retested both directions after refresh.

Short hook:

- "Changing one date used to create three different realities."
- "The database said no, and it was right."

Human-build detail:

- Dmitrii repeatedly tested the workflow from the user's side: change in Production, refresh, change in Marketing, refresh.
- Small layout corrections mattered too. A short Phase 4 title exposed a mobile alignment rule that longer titles had accidentally hidden.

### Reel Teaser: Move The Release, Move The Whole Plan

Next story:

- The shared release date now moves Marketing automatically.
- The next step is to shift the subordinate Production deadlines when Dmitrii changes release order.
- This turns rescheduling from many manual edits into one planning action while preserving the production sequence.

Short hook:

- "What if moving one release could move the whole production calendar with it?"

### Reel: One Release Date Moves The Studio Calendar

Core story:

- The teaser became working software: changing one release date now rebuilds the real Production sequence from Drums to Release.
- Demo stays outside the formula because a demo can exist for a year before the band starts full production.
- The calendar follows the way Dmitrii actually works: three days to Guitars, one to Bass, three to Vocals, three to Edit, five to Mix, then the final delivery steps and fourteen distributor days.
- Production deadline means Distributor day; Release date remains the public achievement shared with Marketing and Roadmap.

Short hook:

- "I moved one release, and the whole studio calendar moved with it."
- "The difficult part was not coding dates. It was describing how music production really happens."

Human-build detail:

- The schedule came from Dmitrii thinking aloud about his actual process, then correcting one missing interval: Bass to Vocals is three days.
- This is a strong example of AI collaboration working best when the user supplies lived workflow knowledge rather than only asking for a generic feature.

### Reel: The Dashboard Becomes A Window Into The Roadmap

Core story:

- The main Dashboard used to show a static Phase 1 illustration.
- Beta 1.9 replaces it with the same live phase data as Roadmap: real song count, status boxes, dates, and an expandable compact song list.
- The full planning controls stay in Roadmap; Dashboard gives the quick strategic glance.

Series connection:

- Earlier betas made each operational module real one by one.
- Beta 1.9 connects those modules into one longer plan, while keeping the Dashboard useful on a phone.

### Reel: Rebuilding The Campaign History Without Guessing

Core story:

- The Marketing module worked for new campaigns, but the old campaigns still contained rough planning data rather than the content Love Strings actually published.
- We collected Instagram Posts, Reels, and Carousels through the connected API, then requested the Instagram archive because Stories were not available through the same historical API.
- The first Story export contained reposts of feed content. We filtered those out so one Reel shared to Stories would not be counted as two separate pieces of work.
- We added the YouTube upload history from the original Release Media Plan and put Instagram, Stories, and YouTube into one review spreadsheet.
- Automation could suggest a campaign from the date and caption, but overlapping campaigns such as Wonderful Life and Jukebox still needed human knowledge. Dmitrii reviewed the final campaign assignment row by row.
- We agreed explicit reconstruction rules before touching the database:
  - a main Instagram publication completes Make video/post and IG Upload;
  - a YouTube publication completes Make video/post and YT Upload;
  - a unique Story becomes its own completed extra task;
  - platform tasks that genuinely did not apply become Irrelevant rather than falsely unfinished;
  - confirmed content after a normal campaign window adds only that individual date, not a fake continuous tail.
- Before writing anything, we generated a dry-run report showing every proposed date, clip name, task status, and extra Story task.
- The final import backed up all five campaigns, checked that Supabase had not changed since the dry run, updated each campaign atomically, and verified the saved result against the approved proposal.

Result:

- Five historical campaigns became evidence-based operating records: Intro, Wonderful Life, Jukebox, Flowers, and Rock and Roll.
- The reconstruction added 36 confirmed post-campaign dates and 80 completed Story tasks while preserving unrelated and pre-campaign evidence outside the campaign calendars.
- Dmitrii then reviewed every campaign in the real app and made the final small human corrections.

Short script:

- "Our app knew how we planned the campaigns, but not what we actually published."
- "So we pulled Instagram posts, exported Stories, opened the old YouTube plan, and built one review sheet."
- "AI suggested the matches. I corrected the campaign context."
- "Then we made a dry run, backed up the database, and rebuilt five campaigns from real evidence."
- "The point was not to make history look perfect. It was to make the dashboard remember what really happened."

Visual sequence:

1. Show the Instagram export screen and the raw archive folder.
2. Flash the consolidated Google Sheet with `Final campaign (EDIT)`.
3. Show the dry-run report with before/after statuses.
4. Show one campaign before reconstruction.
5. Refresh and expand the reconstructed campaign with Story tasks and extended dates.
6. End on the Focus Queue score reset: historical cleanup is valuable work, but it should not pretend that 44 old tasks were completed today.

Human-build detail:

- Dmitrii noticed that the campaign tails often continued beyond the official 14-day framework. Instead of forcing the past to fit the ideal process, the app now records those confirmed individual dates.
- `Blooming` looked ambiguous to an automatic matcher but Dmitrii knew it belonged to Jukebox.
- This episode should show the division of labor clearly: APIs and scripts collect and compare; the musician supplies meaning; guarded database tools make the final change safely.

Series connection:

- Marketing was the first working module and Yuliia was already using it daily while the rest of the dashboard was still being developed.
- Reconstructing the earlier campaigns closes that loop: the first useful module now contains not only future plans, but the real path Love Strings took while learning its own release system.
- This is also a strong bridge into future analytics. Campaign percentages, benchmarks, and content patterns become meaningful only after the historical records reflect reality.

### Reel: Not Every Post Belongs To A Song

Core story:

- Marketing originally assumed every campaign belonged to a Production song. That made the data tidy, but it did not match Yuliia's real work.
- She also needs to plan band updates, event promotion, and standalone social ideas without inventing a fake song in Production.
- Beta 1.10 introduces a separate general-campaign workflow: its own title, date range, artwork, optional progress, and days that can be removed when the plan changes.
- Song campaigns remain strict and release-linked; general campaigns are deliberately flexible.

Short hook:

- "The database was organized. Real life was not."
- "We stopped forcing every social post to pretend it belonged to a song."

Human-build detail:

- This feature came from daily use, not a roadmap workshop. Yuliia described the missing workflow and the data model changed around the work instead of asking the work to fit the model.

### Reel: One Number, One Owner

Core story:

- A campaign expense once saved differently on mobile and desktop because browser storage had become an accidental second source of truth.
- We moved campaign budget lines into Supabase and kept each generated ledger row owned by its source module.
- The Budget ledger now sends edits back to Marketing, Production, or Events instead of allowing a derived number to drift away from its origin.
- Recurring subscriptions without an end date now mean exactly what they mean in real life: active until cancelled, with only the useful forecast window shown.

Short hook:

- "The same expense had two values on two screens. That was the clue."
- "A financial dashboard only works when every number has one owner."

Series connection:

- Earlier episodes showed modules becoming functional one by one. Beta 1.10 is about tightening the connections so those modules behave like one system.

### Reel: Mobile Use Is Product Design

Core story:

- The desktop build looked correct, but iPhone use exposed the operational details: no minus key on the numeric keyboard, fields zooming the whole interface, navigation disappearing above a long card, and important controls using too much width.
- The app gained reusable positive/negative controls, 16px mobile inputs to prevent focus zoom, and a sticky module menu while the brand header scrolls away.
- These are small changes individually, but together they decide whether the app can be used in the moment or only admired later on a laptop.

Short hook:

- "The feature worked on desktop. Then I tried to enter an expense on an iPhone."

### Story Beat: Reward The Planning, Not Only The Posting

Core story:

- Yuliia started planning the future Shallow campaign and marked several tasks `In progress`, but the campaign bar did not move because the original percentage counted only completed tasks.
- That felt wrong: planning a campaign is real work and the interface should acknowledge momentum when it happens, not weeks later when the post goes live.
- We changed Marketing progress to a points model: Not started = 0, In progress = 1, Done = 2, and Irrelevant is excluded.
- Every campaign day has a maximum of six points. If a standard platform task is irrelevant, the day's possible total falls; a relevant extra task can restore that capacity, but additional work cannot inflate one day beyond six.
- Yuliia tested one more future task as `In progress`: the day immediately turned yellow and the campaign percentage increased.

Short hooks:

- "Why should an app wait until the post is published before it rewards the work?"
- "She was already building the campaign, but the progress bar said zero."
- "The yellow box means the plan has started moving."

Human-build detail:

- The correction came from watching the app during real campaign planning, not from a theoretical scoring exercise.
- Focus Queue rewards daily execution; Marketing progress now separately reflects the campaign's own preparation and completion.
- This strengthens the recurring `beat yourself` theme without confusing the two systems: one measures today's effort, the other measures campaign momentum.

### Reel: One Band, Two Logins

Core story:

- Dmitrii and Yuliia had been sharing one password because the first priority was making the workflow useful.
- As daily use grew, shared access became the wrong foundation: the band data should stay shared, but identity and interface preferences should belong to each person.
- Beta 1.11 replaces the shared browser password with invitation-only individual accounts inside one Love Strings workspace.
- Dmitrii tested the migration first so Yuliia would not receive an unexpected invitation while unavailable; only after the production build is ready will her account be invited.
- The same structure prepares the app for personal Dashboard card visibility, ordering, and dark mode without duplicating songs, campaigns, events, or money records.

Short hooks:

- "We needed two accounts, but not two versions of the band."
- "The data stays shared. The experience becomes personal."

Human-build detail:

- The first invitation exposed a real callback problem: the email reached the correct password screen, but the session token was not consumed.
- We added support for Supabase's invitation link formats, sent one fresh setup email, and tested password creation, sign-out, sign-in, refresh, and shared-data access end to end.

### Story Beat: The First Login Already Feels Personal

Core story:

- Individual credentials solved access, but the interface still needed to tell each person, immediately, that this was their own account inside the shared band workspace.
- We added a personal greeting, profile settings, and private avatars while keeping songs, campaigns, events, budgets, and roadmap data shared.
- Dmitrii quietly prepared Yuliia's name and singing photo before sending her invitation, so her first login would open with `Hi, Yuliia` and a familiar face already in place.
- The avatar is one of the few image assets stored directly by the app: it is resized before upload, kept in private Supabase Storage, and served through a short-lived signed link.

Short hooks:

- "Two accounts, one band, and a small first-login surprise."
- "The data is shared. The welcome is personal."
- "Before she logged in, the app already knew how to say hello."

Series connection:

- Beta 1.11 established separate identity and shared ownership. Beta 1.12 makes that architecture visible and human, then prepares the way for personal Dashboard layouts and dark mode.

### Reel: One Google Login, Several Useful Doors

Core story:

- The next integration challenge was not another isolated API key. Gmail, YouTube, and website analytics all belong to the same Google world, but they do not need the same permissions.
- We built one workspace-level Google connection that can open YouTube and Analytics independently, while deliberately leaving sensitive Gmail access for a later consent step.
- The refresh grant stays encrypted on the server; the browser sees connection status and useful numbers, never the reusable credential.
- The first result is a live Website Analytics card using the same daily snapshot, graph, scheduler, and manual-refresh language as the music platforms.

Short hooks:

- "One Google account does not have to mean one giant permission request."
- "We connected the website without handing OAuth secrets to the browser."
- "The newest platform card is not a music platform at all. It is our own website."

Series connection:

- Separate user accounts made identity explicit. Workspace roles decide who can manage shared connections. Google onboarding is the first step toward making a fresh musician workspace configurable without editing deployment secrets by hand.

### Reel: The Second Band Test

Core story:

- LS Dashboard began as a practical system for Love Strings, so the earliest
  data, labels, and defaults naturally revolved around one band.
- The important product decision was not to make a second Love Strings copy.
  Love Strings became the flagship/reference workspace inside one shared app:
  build a feature once, then let every workspace receive it by default.
- That required more than adding another row in a database. We introduced
  workspace roles, invitation-only membership, workspace-scoped branding and
  integrations, and a safe way to create the first real second workspace:
  Test Band.
- The moment both `Love Strings` and `Test Band` appeared in the selector made
  the new product shape visible. Two independent bands could use the same
  dashboard without sharing songs, campaigns, events, money, analytics, or
  logos.
- During the final QA, Test Band was clean in the database but its empty
  Dashboard still showed Love Strings' default Roadmap Phase 1. That small
  visible leak mattered: isolation is not complete if another customer's plan
  can appear even as a harmless-looking default.
- We removed the fallback and gave an empty workspace its own honest empty
  state instead.

Short hooks:

- "We did not build a second app for a second band."
- "The second workspace found the bug the first workspace could never show us."
- "If Test Band can see Love Strings' roadmap, the app is not multi-workspace yet."
- "Build it once. Let every band use it separately."

Visual sequence:

1. Show early Love Strings Dashboard screens and the original one-band framing.
2. Show the roles/settings work: Owner, Admin, Member, Viewer.
3. Show Test Band being created with an empty Dashboard.
4. Open the workspace selector and show Love Strings beside Test Band.
5. Switch from full Love Strings data to the empty Test Band state.
6. Show the unexpected Phase 1 Roadmap card, then the corrected `No roadmap
   phases yet` state.
7. End on the principle: one codebase, separate workspace data.

Human-build detail:

- The milestone is not a generic SaaS story invented in advance. It came from
  looking at a real Love Strings operating dashboard and asking whether another
  band could use the exact same tool without inheriting Love Strings' history.
- The QA finding is the useful emotional proof: a default can feel harmless to
  the developer and still be wrong to the second customer.
- This is a bridge from the earlier "one band, two logins" episode. First the
  people gained separate identities; now independent bands gain separate
  operating spaces, while future product features remain shared.

### Reel: The First Real Invitation

Core story:

- A second workspace is only real when another person can enter it without
  inheriting access to the first one. Test Band became the first full test of
  that moment.
- We replaced the overloaded workspace Owner label with three clear roles:
  Admin, Member, and Viewer. Platform Operator stayed separate, so operating a
  band never quietly grants the ability to create or inspect other workspaces.
- The Admin can now manage a workspace's people and invitations, but the
  database itself refuses to leave a band with no Admin.
- The first real invitation email exposed a final seam: Supabase had completed
  authentication, but the dashboard server had not yet received the browser's
  matching auth cookie. The solution was not to loosen access; it was to verify
  the freshly established session securely at the handoff.

Short hooks:

- "The first real invite found the last invisible gap."
- "A role is not just a label when someone can lose access with one click."
- "Authentication worked. The handoff did not. So we fixed the handoff."

Series connection:

- The second-band story moves from isolated data to real collaboration: one
  shared dashboard, a clearly bounded Admin role, and an invitation path that
  reaches the right workspace without exposing the first band's operations.

### Reel: The Dashboard Was Multi-Workspace — Until It Wasn't

Core story:

- Beta 1.15 proved that Love Strings and a clean second workspace could share
  one app without sharing everyday records. That was the expected finish line.
  Preparing the first external artist showed it was only the first proof.
- We used `Test Band`, later renamed `BIOGLYCERIN`, as a controlled real artist
  workspace: no platform accounts, no releases, no metrics, no inherited Love
  Strings history. That empty starting point made assumptions visible.
- The manual refresh route correctly knew which workspace had asked for data.
  But some collectors still got their artist identity from Love Strings
  deployment settings. An unrelated platform account in a second workspace
  could therefore have triggered a Love Strings collector and written its
  results into the wrong workspace.
- This was not a cosmetic empty-state issue. It was the point where “one
  codebase” needed a stricter rule: a collector cannot run unless that specific
  workspace has the configuration needed to identify its own artist.
- The correction was deliberately small. We did not build every music-service
  integration. We put a safety gate in front of the existing collectors, so
  missing configuration means “not configured,” never “use Love Strings.”
- The same lesson changed card visibility: history is useful, but it is not a
  live connection. Disconnecting YouTube, Website Analytics, or Topic should
  not leave a card looking active just because old snapshots are still stored.

Short hooks:

- "Multi-workspace worked — until we gave the second band a real empty start."
- "A route can know the right workspace while a collector still knows the wrong artist."
- "No configuration must mean no collection. Not a Love Strings fallback."
- "Historical data is history. It is not proof that a service is connected."

Visual sequence:

1. Show Love Strings with live platform cards beside an intentionally empty
   BIOGLYCERIN workspace.
2. Show the harmless-looking Refresh action and explain the hidden global
   artist assumption.
3. Cut to the safety rule: workspace configuration → eligible collector →
   workspace metric rows.
4. Disconnect a service while retaining its graph history, then show the active
   card disappear honestly.
5. End on the product principle: an empty artist workspace should be quiet,
   not accidentally look like Love Strings.

Human-build detail:

- The useful part of the story is that the defect was found before an external
  artist could receive incorrect data. A clean test workspace was not merely a
  demo environment; it was a way to discover assumptions the flagship
  workspace could never reveal.

### Reel: We Thought It Was YouTube Music

Core story:

- The dashboard already had a separate card labelled “YouTube Music.” Its
  graphs and history were useful, so the easy move would have been to call it
  finished.
- Real external-workspace onboarding forced a closer look. The collector was
  following a public `Artist Name - Topic` channel, not a future YouTube Music
  service integration.
- That distinction matters for artists. There are three different ideas:
  their normal managed YouTube Channel, a separate auto-generated YouTube Topic
  channel, and an eventual actual YouTube Music platform integration.
- We kept the useful historical collector identity (`youtube-music`) in place,
  but changed the product language to YouTube Topic. Nothing had to be deleted,
  duplicated, or reseeded to tell the truth about the data.
- The Google architecture also became clearer: there is one shared LS Dashboard
  Google OAuth application, not one OAuth app per band. Each workspace Admin
  authorizes their own Google account through that shared flow, and the
  resulting encrypted authorization, channel identity, scopes, and Analytics
  settings belong to that workspace.
- A Topic channel is public, so it can be easy to paste the wrong URL. The
  first real checks found the Official Artist Channel edge case too: an artist's
  main channel may already be consolidated, so there may be no separate Topic
  channel to connect. The UI now resolves first, shows the found channel,
  warns about a likely name mismatch, explains the consolidated-channel case,
  and waits for an explicit confirmation.
- The work briefly appeared to fail for an unglamorous reason: the new Topic
  migration was present locally but not remotely. Google status and Topic save
  requests failed because their new workspace columns did not exist in the
  active database. Applying the existing migration fixed the real schema gap;
  it did not need a second workaround migration.

Short hooks:

- "The card had years of useful history — and the wrong name."
- "A Topic channel is not YouTube Music. That tiny distinction changes onboarding."
- "One OAuth app. Different artists. Different stored channel identities."
- "Before connecting a public channel, let the artist see exactly what was found."
- "Sometimes an integration bug is not OAuth. It is one migration that never reached the database."

Visual sequence:

1. Open the old “YouTube Music” card and its existing evolution graph.
2. Show a real `Artist Name - Topic` search result beside the normal channel.
3. Draw the simple three-part distinction: YouTube Channel / YouTube Topic /
   future YouTube Music.
4. Show the Topic input, Check Topic, resolved title/ID, caution, and explicit
   Use this Topic action.
5. Show the same-channel informational message for an Official Artist Channel.
6. End by renaming the card to YouTube Topic while its graph remains intact.

Human-build detail:

- This is a good “we learned in public” episode. The existing implementation
  was not thrown away; the team followed the evidence, named the data honestly,
  and protected the artist from silently connecting somebody else’s channel.

### Reel: The Refresh Button That Became an Invitation Test

Core story:

- External onboarding did not only test platform connections. It tested the
  smallest human moments: a temporary workspace name and the first invitation
  a real Viewer opens.
- `Test Band` became `BIOGLYCERIN` in place. The workspace kept its ID,
  members, metrics, YouTube/Analytics settings, and history; only the artist
  name changed. That is what “your own workspace” should feel like.
- Then a real Viewer invitation got stuck on “Joining workspace…” until the
  browser was manually refreshed. Authentication had started correctly, but
  the page's one-time initialization had checked before the Supabase browser
  session was ready and did not resume at the right moment.
- The fix was not to weaken invitation checks or store a password. The page now
  waits, listens for the established session, continues automatically, and
  guards the acceptance request so repeated auth events cannot create duplicate
  membership work.
- A browser offered a different strong password after refresh during testing.
  That was the browser/password manager doing its job, not LS Dashboard
  generating, caching, or reusing passwords.

Short hooks:

- "A workspace becomes real when it can change its name without losing itself."
- "The first Viewer invitation found a race condition no checklist could see."
- "The page was waiting for a session it had already checked too early."
- "The password suggestion came from the browser — not from the app."

Series connection:

- The second-band arc now moves beyond database isolation: real artists need
  their own name, their own platform identity, and an invitation that works on
  the first click. Beta 1.16 was built by following those real moments rather
  than designing an abstract onboarding flow in advance.

### Beta 1.16 release close: a dashboard that reads at a glance

The external-artist safety work made the dashboard trustworthy; the final
Viewer Showroom & UI Polish pass made that trust easier to read. Rather than
redesigning the product, the app adopted one quiet visual grammar: each module
keeps its own restrained left-edge identity, parent surfaces carry the stronger
signal, and child cards use a thinner one. Budget keeps its own identity even
inside a campaign, song, or event because the financial meaning travels with
the record.

The release close also turned General Settings into three understandable areas
for an external artist: identity, members, and connections. Future providers
are shown honestly as onboarding placeholders, while working Google services
remain separate. The next product chapter is intentionally not an extension of
this polish: Viewer Playground will introduce sandboxed Viewer interaction and
needs its own data-ownership and permission design.

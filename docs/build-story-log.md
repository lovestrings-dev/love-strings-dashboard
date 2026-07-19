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

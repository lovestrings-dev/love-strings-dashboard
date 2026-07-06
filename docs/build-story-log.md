# Build Story Log

Purpose: preserve the Love Strings Dashboard build as a story that can later become Instagram Reels, Shorts, captions, and behind-the-scenes posts.

This file is written for storytelling first, not engineering precision. Keep it understandable for independent musicians who are curious about building useful tools with AI.

## Story Rules

- Use simple language and explain what changed in the musician workflow.
- Track platforms touched, because setup work on GitHub, Supabase, Vercel, YouTube, Instagram, and Meta is part of the story.
- Keep approximate time even when exact time is unavailable.
- Separate what Dmitrii did manually from what Codex helped design or implement.
- Prefer story beats that can become short clips: problem, action, result, lesson.

## Current Story Arc

Working theme:

An independent musician is building a custom dashboard for the real work around releases: platform stats, campaign tasks, production planning, and daily decision-making.

Audience framing:

- This is not just "coding an app".
- This is learning how to build small custom business tools around a real creative project.
- The dashboard gradually turns scattered platform dashboards, spreadsheets, and manual notes into one shared workspace.

## Timeline Beats

| Day / Session | Approx. Time | Main Actions | Platforms / Tools | Story Angle |
| --- | ---: | --- | --- | --- |
| First build session | 1h 42m | Turned rough dashboard idea into an early working prototype. Defined the first modules and infrastructure direction. | Codex, local Mac, Next.js, GitHub, Supabase | "I started with a rough idea and, in under two hours, had the first working version of a musician dashboard." |
| Infrastructure setup | Earlier TBD | Created GitHub account/repo, connected Supabase, set up CLI access, and prepared cloud-backed app data. | GitHub, Supabase, Terminal, Codex | "Before the app became useful, we had to give it a real memory and a place to live." |
| Marketing module build | Earlier TBD + 0h 45m tracked | Built the campaign tracker with release dates, daily tasks, progress bars, editable campaign cards, album art URLs, and dashboard previews. | Next.js, Supabase, Cloudinary | "The app started to understand how a music release campaign actually works: daily videos, uploads, progress, and release dates." |
| Platform metrics connection | 2h 14m + earlier TBD | Connected YouTube and Instagram API importers, tested latest Short/Reel stats, added 30-day reach/views, and stored daily metric snapshots in Supabase. | YouTube API, Instagram API, Meta Developers, Supabase | "Instead of checking every platform manually, the app began collecting the numbers itself." |
| YouTube Music connection | 0h 20m tracked | Found that the YouTube Music artist page is available as a Topic channel through the existing YouTube Data API and added it to the collector plan. | YouTube Music, YouTube Data API, Supabase | "One more platform moved from manual checking into the dashboard's daily memory." |
| First deployed beta | 0h 20m + earlier deployment time TBD | Published Beta 1.1 on Vercel, protected it with Basic Auth, verified the live refresh button, and made it usable outside the local computer. | Vercel, GitHub, Supabase | "The prototype became a real private web app that Yuliia could open too." |
| Daily autopilot setup | 0h 20m tracked | Added GitHub Actions scheduler for the protected daily 06:00 Europe/Vienna metrics refresh. Manual workflow test showed a green checkmark. | GitHub Actions, Vercel, Supabase | "The app now has its first autopilot habit: wake up every morning and update the platform stats." |

## Reel Ideas From Current Build

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

## Open Story Details To Fill Later

- Exact first-session date.
- Better split of the early `1h 42m` between architecture, infrastructure, and UI.
- Screenshots or screen recordings from Vercel, Supabase, GitHub Actions, and the app.
- Dmitrii's spoken reflections: what felt surprising, confusing, or exciting.
- Yuliia's first feedback after opening the deployed beta.

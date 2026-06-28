# Architecture

## Target Stack

Initial target stack:

- Frontend/app: Next.js with React
- Hosting: Vercel free tier
- Database: Supabase free tier / PostgreSQL
- Authentication later: Supabase Auth
- Data imports first: Excel/CSV/Google Sheets exports
- API integrations later: YouTube, Instagram, Spotify or platform exports, website analytics, distributor reports

## Hosting Direction

Use Vercel free tier for the first deployed prototype.

Reasons:

- Free to start
- Good fit for Next.js dashboards
- Simple deployment from GitHub
- Works well for mobile and desktop web apps
- Supports frontend and backend API routes
- Credible for a portfolio/business case

## Data Source Direction

Build the project database early.

Excel and Google Sheets should be used only as bootstrap/import sources, not as the long-term source of truth. The dashboard should read from our own database so Love Strings can track historical development over time.

External platforms such as YouTube, Spotify, Instagram, TikTok, distributor dashboards, and website analytics should be treated as source systems. The app should collect only the needed metrics from those systems and store daily snapshots in the database.

## High-Level Data Flow

```text
Platform APIs / exports
YouTube / Instagram / Spotify / Website / Distributor
        |
        v
Daily import jobs or manual imports
        |
        v
Supabase PostgreSQL database
        |
        v
Next.js dashboard on Vercel
        |
        v
Desktop and mobile UI
```

## Early Database Areas

Likely tables/entities:

- songs
- releases
- sprints
- tasks
- platforms
- platform_metric_snapshots
- content_posts
- budget_transactions
- live_events
- roadmap_milestones
- api_import_logs

## Historical Metrics Model

The key historical table should store daily snapshots from different sources.

Conceptual fields:

- date
- platform
- account/channel/profile
- song/release/content item, optional
- metric name
- metric value
- source
- imported_at

This should support:

- YouTube subscribers by day
- YouTube views by video by day
- Spotify streams by song by day
- Instagram followers/reach by day
- Release performance after 7/14/30 days
- Campaign performance over time

## Future AI Agent Fit

The database-first architecture is important for future AI agents. Agents should work from the project database and task/state history instead of scraping UI dashboards repeatedly.

Possible future agents:

- Daily analytics collector
- Release checklist generator
- Marketing schedule assistant
- Budget anomaly checker
- Sprint retrospective summarizer
- Platform performance analyst

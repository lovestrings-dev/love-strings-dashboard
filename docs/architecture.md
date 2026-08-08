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

## Multi-Workspace Product Invariant

Love Strings is the flagship and reference workspace, not a special application
instance. The application has one shared codebase, UI, backend, and schema for
every workspace.

Workspace-specific differences must be represented only by workspace-scoped
data, settings, branding, permissions, integrations, or explicit feature flags.
Do not add duplicated implementations, Love Strings-only application branches,
or workspace-name checks for product behavior. New functionality built while
using Love Strings should be available to all workspaces by default unless an
explicit, workspace-scoped feature flag intentionally controls rollout.

## Current Multi-Workspace Boundary (Beta 1.15)

- `app_workspaces`, workspace settings, memberships, and workspace-scoped
  operational rows form the tenant boundary. Love Strings is the reference
  workspace; Test Band is the first separately provisioned workspace.
- `platform_operator` is a platform-level privilege held only in
  `app_platform_operators`; it is not a workspace role and does not grant
  workspace membership or operational access.
- Workspace roles are Admin, Member, and Viewer only. Admins can manage their
  own workspace's settings, branding, integrations, invitations, and existing
  memberships; Members edit normal operational data; Viewers are read-only.
  Workspace Admin does not grant platform privileges. A database trigger
  prevents a workspace from losing its last Admin during a demotion or removal.
- Authentication creates an account/profile only. Invitations are scoped to a
  recipient, role, and `workspace_id`, with pending, accepted, expired, and
  revoked lifecycle states. Admins can update a pending role, resend (rotating
  the token), or revoke only their active workspace's invitations. Server-side
  acceptance validates the authenticated recipient and atomically creates an
  idempotent membership without changing memberships in other workspaces.
- Invitation acceptance accepts a newly established Supabase session through a
  verified same-origin bearer token when the browser's auth cookie is not yet
  available to the server. The workspace token remains hash-only at rest and
  is never returned by normal APIs.
- The active workspace is the server-validated `ls_active_workspace`
  HTTP-only cookie. The app retains a valid selected membership, chooses the
  first membership by creation time when selection is absent/invalid, and
  presents a no-workspace state when the user has none. It never grants Love
  Strings membership or selects it merely because it is the reference.
- The selector receives only membership-safe metadata: workspace ID, name,
  slug, branding-path reference, and the member's role. Switching is validated
  on the server and hard-reloads client state.
- Workspace provisioning is server-only and restricted to platform operators.
  It atomically creates a workspace row, settings, initial Admin membership,
  and dashboard preference only; it must never copy operational data,
  integrations, analytics, CRM data, or branding from another workspace.
- Workspace branding uses a UUID-scoped storage path. Storage and settings RLS
  require both membership and a matching workspace path, so an administrator
  of one workspace cannot access another workspace's branding object.
- Service-role routes resolve the selected workspace through server-side
  membership before reads, upserts, replacement RPCs, refreshes, or deletes.
  Browser local storage is not an operational data source across workspaces.

Current integration boundary:

- Google sign-in is authentication-only and separate from connecting Google
  services. Normal sign-in does not authorize Gmail, Drive, YouTube, Analytics,
  or other account content.
- Google connection records belong to a workspace. Refresh tokens are encrypted
  server-side; normal clients receive status metadata, never reusable OAuth
  credentials. Admin connection controls remain limited to their active
  workspace.
- The existing Google Analytics property preference and scheduled metric
  collector still target Love Strings operationally. Multi-workspace collection
  is intentionally deferred rather than silently applying that integration to
  a new workspace.

## Data Source Direction

Build the project database early.

Excel and Google Sheets should be used only as bootstrap/import sources, not as the long-term source of truth. The dashboard should read from our own database so Love Strings can track historical development over time.

External platforms such as YouTube, Spotify, Instagram, TikTok, distributor dashboards, and website analytics should be treated as source systems. The app should collect only the needed metrics from those systems and store daily snapshots in the database.

Current working API source systems:

- YouTube Data API
- Instagram API
- YouTube Music Topic channel through the YouTube Data API
- Spotify Web API

## High-Level Data Flow

```text
Platform APIs / exports
YouTube / Instagram / Spotify / Website / Distributor
        |
        v
Server-side collectors
Scheduled 01:00 Europe/Vienna job or manual Dashboard Refresh
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

The key historical table stores daily snapshots from different sources.

Conceptual fields:

- date
- platform
- account/channel/profile
- song/release/content item, optional
- metric name
- metric value
- source
- imported_at

Current implementation:

- Table: `platform_metric_snapshots`
- Uniqueness: `snapshot_date + platform + account + content + song + release + metric + source`
- Manual refresh updates the current date's rows instead of creating extra rows for every click.
- This keeps the database small while preserving one daily metric value per tracked signal.

This should support:

- YouTube subscribers by day
- YouTube views by video by day
- Spotify streams by song by day
- Instagram followers/reach by day
- Release performance after 7/14/30 days
- Campaign performance over time

## Current Platform Collector Status

YouTube collector:

- Reads Love Strings channel data.
- Detects latest regular video and latest Short from the channel uploads playlist.
- Stores channel subscribers, latest regular video views, and latest Short views.

Instagram collector:

- Reads Love Strings Instagram account profile and media.
- Stores followers, accounts reached in the last 30 days, views in the last 30 days, and latest Reel/Post views.

YouTube Music collector:

- Reads the Love Strings Topic channel through the YouTube Data API.
- Stores Topic channel subscribers, total plays from channel views, and current release plays from the latest uploaded track.
- Uses YouTube API `views` as app-level YouTube Music `plays` because the Topic channel videos represent tracks.

Spotify collector:

- Reads the Love Strings Spotify artist profile through the Spotify Web API.
- Stores artist followers and Spotify popularity score.
- Does not store exact stream counts yet because Spotify's public Web API does not expose Spotify for Artists stream totals.

Apple Music CSV import:

- Reads Apple Music for Artists song CSV files from a browser file upload.
- Parses the file once in the browser, sends structured rows to the app API, writes extracted metrics to Supabase, and discards the original file.
- Stores all available CSV columns for each song: plays, average daily listeners, Shazam count, radio spins, and purchases.
- Stores dashboard aggregates for last update date, total plays, total Shazams, current release name, current release plays, and current release Shazams.
- Treats each CSV as a lifetime report snapshot, so future campaign analysis should compare two imported lifetime snapshots rather than expect daily Apple data.

Refresh modes:

- Daily scheduled refresh: GitHub Actions calls the protected endpoint several times around 01:00 Europe/Vienna: `23:05/23:20/23:35/23:50 UTC` during daylight saving time and `00:05/00:20/00:35/00:50 UTC` during standard time.
- The endpoint accepts delayed scheduled calls, because GitHub Actions can run scheduled workflows much later than requested. Repeated successful calls update the same Vienna-date daily rows instead of creating duplicate snapshots.
- Platform metric snapshots use the Europe/Vienna calendar date so early-morning local runs are stored under the expected local day.
- Manual Dashboard Refresh: intentional on-demand update for fresher data.
- App load: read-only; it should not call external APIs.

## Future AI Agent Fit

The database-first architecture is important for future AI agents. Agents should work from the project database and task/state history instead of scraping UI dashboards repeatedly.

Possible future agents:

- Daily analytics collector
- Release checklist generator
- Marketing schedule assistant
- Budget anomaly checker
- Sprint retrospective summarizer
- Platform performance analyst

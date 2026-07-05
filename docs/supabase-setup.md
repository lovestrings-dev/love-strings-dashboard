# Supabase Setup

## Current Integration

The Supabase GitHub integration is connected to the Love Strings dashboard repository.

Recommended settings:

- GitHub repository: `lovestrings-dev/love-strings-dashboard`
- Working directory: `.`
- Production branch: `main`
- Deploy to production: enabled

## Next Supabase Steps

1. Keep the GitHub integration connected to `main`.
2. Confirm the repository contains the `supabase/` folder.
3. Merge database migrations into `main` when they are ready to apply to production.
4. In Supabase, check the database schema after deployment.
5. Keep Row Level Security enabled on all project tables.
6. Add user-facing RLS policies when Supabase Auth is enabled.
7. Store frontend environment values outside Git:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deployment Protection

The app has temporary Basic Auth protection through `proxy.ts`.

Set these server-side environment variables in Vercel before sharing the app:

- `APP_BASIC_AUTH_USER`
- `APP_BASIC_AUTH_PASSWORD`

If either value is missing, the local/deployed app stays open. This is useful for local development, but production should have both values set before sharing the link.
   - `SUPABASE_SERVICE_ROLE_KEY`

## First Data Model

The first schema focuses on a database-first dashboard:

- songs and releases
- platforms and platform accounts
- content posts
- daily platform metric snapshots
- sprints and tasks
- budget transactions
- import logs

`platform_metric_snapshots` is the key historical table. It stores daily metrics from YouTube, Instagram, Spotify, the website, distributors, and future API/import sources.

## Security Notes

The initial migration enables Row Level Security and does not add broad anonymous access policies.

This means direct browser reads will be blocked until app-specific authenticated policies are added. Server-side jobs can still use the Supabase service role key, which must never be committed to Git.

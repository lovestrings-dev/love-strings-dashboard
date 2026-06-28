# Decisions

## 2026-06-28 - Initial Hosting Direction

Decision:

- Use Vercel free tier as the initial hosting target.
- Use Next.js / React as the likely first app stack.

Reason:

- The project is currently in prototype/learning mode.
- Vercel is free to start and beginner-friendly.
- It is a strong fit for responsive dashboard apps.
- It gives the project portfolio value beyond the Love Strings use case.

## 2026-06-28 - Database Direction

Decision:

- Build an own database early.
- Use Supabase free tier / PostgreSQL as the initial database target.
- Treat Excel and Google Sheets as import/bootstrap sources only.
- Store selected daily metrics from external platforms in our own database.
- Dashboard should read from the database, not directly from every source platform.

Reason:

- The project needs historical business development, not just current platform numbers.
- Platform dashboards are source systems, not a reliable long-term business memory.
- Supabase gives a real PostgreSQL database, hosted free tier, auth later, and a good admin UI.
- This architecture supports future AI agents and professional business-app credibility.

## 2026-06-28 - Portfolio/Professional Framing

Decision:

- Build the dashboard first for the real Love Strings hobby business.
- Design and document it cleanly enough to demonstrate business/product thinking for larger corporate use cases.

Reason:

- The same dashboard concepts transfer to corporate contexts: roadmap, sprints, budget vs revenue, marketing execution, KPIs, drill-down analytics, and automation.
- A real small-business case is more credible than a generic demo.

## 2026-06-28 - Project Accounts Context

Known project account context:

- GitHub account: `lovestrings-dev`
- Supabase project/account context: `lovestrings-dev's Project`
- Project email / Google account: `lovestringsband@gmail.com`

Note:

- This file should store account identifiers only, not passwords, API keys, tokens, recovery codes, or database secrets.

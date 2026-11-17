# Pixabay selections in Export

The Export loader previously read only uploaded-video snippets. Saved Pixabay selections already existed in the shared workspace draft, but were excluded from render source choices.

Export now combines those two source lists under Selected videos, with Pixabay thumbnails and creator/source attribution. Each audio × video request carries exactly one source identity: an uploaded asset UUID or a Pixabay video ID. Pair matching keeps these identities separate, including across browser reloads and mixed-source batches.

For Pixabay renders, the existing owner-only POST handler verifies that the ID is selected in the authorized workspace, looks it up through the provider API (24-hour cache), checks duration and the exact HTTPS cdn.pixabay.com video origin, then streams at most 500 MB into the private staging bucket. Redirects are rejected. Browser-supplied download URLs are ignored. The worker still receives gs:// URIs; no worker deployment or schema migration is needed. Temporary inputs use the existing media/ lifecycle prefix.

Render history uses a native details/summary disclosure, collapsed by default, with count, keyboard operation, focus indication, and the existing download/delete controls inside.

## Validation

- TypeScript and targeted ESLint passed.
- Render route authorization/idempotency/manifest regression includes selected/unselected Pixabay IDs and trim validation.
- Batch regression covers two audio excerpts × mixed uploaded/Pixabay videos and source identity matching.
- Provider/staging tests cover ID lookup, origin validation, redirect rejection, oversized/empty streams and partial-object cleanup.
- Existing Pixabay and media-retention regressions passed.
- Verified the running localhost:3000 app against the actual saved workspace selection: starry sky, milky way, cloud, mountain hut (Pixabay 285663) appears in Export with thumbnail and attribution. All ten existing render-history rows expand; Enter collapses them again. Browser error log empty.
- No live render or cloud cleanup was triggered. Local render activation remains as configured; full cloud acceptance is still needed after the eventual app deployment.

No commit, push, deployment, migration, or external configuration change. Other sessions' overlay navigation and generated next-env changes were preserved.

## Subsequent live acceptance

The authorized local cloud setup and actual Pixabay render succeeded; see `studio-local-rendering-2026-11-17.md` for execution, output metadata and playback evidence.

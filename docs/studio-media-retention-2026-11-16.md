# Studio shared media and latest-batch retention

## User-visible behavior

- Video no longer lists, restores or selects device-only recent uploads. A newly
  chosen file has a temporary browser preview while uploading; selection uses
  the shared asset after upload verification succeeds. Existing IndexedDB cache
  files are not read or deleted by this change.
- Shared uploads have an owner-only Delete control with explicit confirmation.
  It deletes the actual private source object, hides its metadata row and removes
  that asset's shared selected snippets. Independent generated videos survive
  deletion of a source. Other devices refresh the source library every 15 seconds.
- Generated-result Delete now removes the actual output object, retaining the
  database audit row with deleted_at. This supersedes the earlier soft-only
  behavior in studio-batch-export-2026-11-16.md.
- Starting a new generation batch requires confirmation that earlier cloud
  outputs in this workspace will be removed. All earlier output objects are
  deleted regardless of whether they were downloaded; local downloaded copies
  are unaffected. Only the new batch's results remain in the active output
  prefix. Other workspaces are never purged. No download-completion tracking is
  claimed; a signed-download redirect does not prove a browser saved the file.

## Retention and concurrency

Each pair submits the same batch UUID and a first-pair flag. The server reserves
its existing unique workspace queued/running slot before any purge. It records
current batch identity in a server-owned workspace state table. An older device
queue cannot replace a newer batch unless it starts a new explicitly requested
batch. Cleanup preserves all job IDs belonging to the current batch, including
previously completed pairs, and removes old/orphan output objects under only
workspaces/{workspace}/studio/renders/. Cleanup is retried idempotently per pair;
a cleanup error fails preparation before a cloud execution can start.

Cached older clients without batch identity receive a refresh-required error.
Previously saved browser batch plans receive batch identity when submitting.

Shared-source deletion is blocked while a render is queued/running. It marks the
source unavailable, rechecks the render slot, then deletes the object. Render
submission rechecks the source after reservation. Together these checks prevent
a racing deletion from removing an input from a running execution. Failed
cloud deletion keeps the source unavailable and supports retry on the same ID.
Atomic draft cleanup touches only that source's uploaded-video snippets. Reads
filter deleted sources and stale writes cannot reintroduce them.

Confirmed dimasounder@gmail.com plus workspace access/non-Viewer role remains
required for destructive/generation actions. Other authorized members retain
read/preview/download access. No IAM expansion is required: verified objectUser
bindings on staging and output buckets already include object list/delete.

GCS output bucket currently has seven-day soft-delete recovery. Normal object
delete removes active objects and links, while Google retains a recoverable copy
for seven days. This change does not disable that recovery policy, remove bucket
protection or claim immediate physical storage reclamation. Staging media and
manifests retain the existing lifecycle policy.

## Migration and rollout

Applied migration: 20261116204751_studio_media_retention.sql.

- Adds source deleted_at and render-job batch_id, plus workspace/batch index.
- Adds server-only studio_render_retention_state with RLS and revoked client
  privileges. Only service_role has table access.
- Adds a SECURITY INVOKER atomic draft cleanup function with execution revoked
  from PUBLIC/anon/authenticated and granted only to service_role.

The user approved this migration and it was applied through the Supabase plugin.
Verified both columns, batch index, RLS, revoked client access, service-role RPC
access and SECURITY INVOKER function. All 4 sources and 10 render/output records
remain intact. Local filename matches the remote migration history. No real cloud
deletion has been performed; cleanup runs only on a subsequent owner action.

The security advisor reports RLS Enabled No Policy as INFO for the retention
table. This is intentional server-only state: client privileges are revoked and
verified false. No client policy is needed. Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Verification

- Real retention helper and route tests: current-batch preservation, earlier and
  orphan output removal, other-workspace isolation, stale device-queue rejection,
  actual output deletion, invalid output path rejection, owner/origin checks,
  active-render and racing-reservation source-delete rejection, retry after cloud
  failure, atomic snippet cleanup preserving audio, hidden deleted selections
  and rejection of stale selection writes.
- Render API tests prove cleanup failure prevents dispatch, and retain account
  restriction, idempotency, source/trim/manifest and deletion access checks.
- Four-pair matching/batch tests and current Beta 1.35 composition/Pixabay checks
  pass. Updated stale release assertions for Export availability/shared selection.
- Local extracted real Video editor verified no Recent uploads, shared delete
  confirmation, selected source removal and clean browser console. Deletion was
  simulated in the local fixture; no live GCS objects were touched.
- TypeScript through production build (65 pages), targeted strict ESLint and diff
  checks pass. React review includes stable derived shared selection identity to
  avoid repeatedly notifying the parent preview on unrelated state updates.

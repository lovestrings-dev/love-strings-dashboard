# Studio 2 × 2 export combinations

## Behavior

Export displays saved audio excerpts and shared selected video snippets as source
cards. Select up to two of each. Generate creates the Cartesian product: A1/V1,
A1/V2, A2/V1, A2/V2. Each request retains the exact source trim and project duration.
Video clips shorter than the output loop using the existing worker.

A 2 × 2 results grid fills as jobs complete, with pair labels, playback, download
and Delete result. Previous renders remain in history. Delete uses confirmation
and a workspace-scoped server route; it soft-deletes the finished render record.
Sources, audit records and private GCS objects remain. Deleted outputs cannot
obtain new preview URLs; already-issued URLs expire within five minutes. Running
results cannot be deleted. Viewer accounts cannot generate or delete.

## Queue and resume

The browser submits pairs sequentially, preserving the existing workspace-wide
one-active-render index. Stable request UUIDs are saved before network submission.
Refreshing/reopening Export on the same device resumes the pending batch. Keep
Export open to dispatch remaining pairs. An already-dispatched Cloud Run execution
continues if the page closes. A different device can see submitted jobs/results,
but does not receive the not-yet-submitted device queue. Dispatch errors pause the
queue; Resume pending pairs reuses request IDs and does not duplicate cloud jobs.
A failed registered pair advances to the remaining combinations without retrying
the paid execution automatically. No worker rollout or IAM changes are needed.

## Database activation

Applied additive migration `20261116192720_studio_render_result_details.sql` adds
nullable result_details and deleted_at columns to studio_render_jobs. Existing
outputs remain readable and have generic Previous export labels. The user approved application. Verified both columns and migration history;
the two existing render jobs and two rendered-asset records are preserved.
The local migration filename matches the remote version.

## Verification

- Existing deployed one-pair pipeline produced two successful actual outputs.
  Real preview loaded 15 seconds at 1080 × 1920, playback reached the end, and
  MP4 download completed.
- Batch/API tests cover all four unique combinations, exact trims, stable
  serialized IDs, bounded choices, authorization, idempotency and manifest paths.
- Delete tests cover foreign origin, Viewer denial, other workspace denial,
  running-job rejection, repeat deletion, audit preservation, hidden history,
  denied preview issuance and blocked relaunch of deleted request IDs.
- Local browser fixture ran exactly four POSTs with four unique IDs, including
  a refresh during processing. Four preview players appeared. Delete removed
  only one result and survived refresh. No browser warnings/errors. Fixture uses
  a sample MP4 with simulated completion; no new cloud executions were started.
- TypeScript, targeted strict ESLint, API tests, batch tests and production build
  (65 pages) passed.

Next: push the prepared local commit through GitHub Desktop, then verify the
actual four selected combinations after Vercel reaches READY.

## Cross-device preview follow-up

The actual four-pair batch completed successfully, with distinct canvas_1.mp4
and IMG_2929.MOV manifests for both Intro excerpts (25.8199–40.8199 and 0–15).
All four Production preview elements loaded 15 seconds with no media error.

The non-initiating browser had no local batch plan. Its fallback displayed the
latest four arbitrary historical jobs, including two older one-pair exports,
and stopped polling whenever it initially saw no active job. This made new
results appear missing or duplicated even though rendering was correct.

Fixed fallback previews to match each selected Cartesian pair by exact trims,
duration and source identity. Unmatched pairs keep their waiting slot; legacy
exports without pair metadata stay in history. Export now polls while open even
when initially idle, so another browser's submitted results appear automatically.
New result metadata includes stable song and video-asset IDs; earlier labeled
results match title/filename plus exact trims. No migration or worker change.

Regression tests cover mixed historical/current rows, four pair positions,
missing fourth slot, trim/duration mismatch and stable-ID precedence. Passive
local browser test picked up a later fourth result without submitting work or
refreshing. API/batch tests, strict lint and production build/TypeScript passed.
An initial standalone typecheck encountered duplicate generated .next type files;
the clean production build regenerated types and passed.

## Proof-of-concept generation account restriction

Only the server-verified, confirmed Auth email dimasounder@gmail.com may submit
FFmpeg render requests (existing workspace membership and non-Viewer role still
required). All other accounts, including other workspace admins, receive
canGenerate=false and cannot reserve jobs, stage audio, or dispatch Cloud Run.
The same account restriction protects result deletion so other accounts have
view-only result access. Read/history/preview/download retain workspace access
checks and remain available to other members/viewers.

The UI displays View-only, disables Generate and automatic queue resumption,
and hides Delete for other accounts. Permissions refresh with render polling.
The authorization uses Auth getUser email/confirmation, never browser input or
user-editable metadata. The environment activation flag remains an additional
generation gate. No schema, IAM, environment or worker change is needed.

Tests verify blocked generation for other roles/emails, spoofed payload email,
unconfirmed email and lookalike domain; confirmed owner succeeds. Other-account
history and signed preview access still work; deletion is denied. API regression,
strict lint and production build/TypeScript passed. Activate by pushing the local
commit and letting the normal Vercel Production deployment finish.

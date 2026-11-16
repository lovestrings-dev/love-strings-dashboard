# Mobile trace and first one-pair export

## Mobile attempts, 16 November 2026

User screenshots at 18:40–18:43 Europe/Vienna show:

- Photos: `IMG_9811.mov` entered “Reading … from this device”, then the
  metadata-read timeout reported “No private upload started”. User reports two
  attempts; the screenshots do not independently identify both invocations.
- Files: `w_warm.mp4` shows the same reading stage and timeout.
- The older `Artist_Pilot_Cut_1.mov` entry is in device-local history. That does
  not prove it was uploaded to private storage.

A Production runtime-error query covering 18:30–18:50 Vienna returned no Studio
upload failure events. Shared database reads returned only `IMG_2929.MOV` and
`canvas_1.mp4`, both previously confirmed desktop uploads. The new filenames
have no completed shared asset record.

The code starts signing only inside `loadedmetadata`. The displayed timeout
therefore locates these attempts before signing, browser PUT or completion.
There is no persisted client-attempt telemetry, so a server request ID or a
deeper Safari decode trace cannot be recovered from these attempts. The iCloud
suggestion is generic help, not proof that iCloud caused the timeout. A future
mobile repair should test a mounted user-visible metadata probe and capture
bounded stage/error telemetry. Mobile repair is deferred in favor of rendering
with the verified desktop assets, as requested.

## Local one-pair export implementation

User chose **one audio/video pair first**; batch generation and editable overlays
remain outside this slice.

Flow:

1. Export chooses one existing saved audio snippet and one shared uploaded video
   (using its saved trim when available). Local-only/Pixabay footage cannot be
   submitted directly to the worker in this version.
2. Legacy song keys such as `intro` are mapped through Production's database ID.
3. Protected POST `/api/studio/render-jobs` authenticates active workspace,
   denies Viewer writes, validates bounds and resolves source records server-side.
   The audio URL supplied by the browser is only a stale-source equality check;
   download uses the URL from the workspace-owned database record, restricted to
   the configured Cloudinary cloud, HTTPS, and no redirects.
4. A request UUID is reserved as the job ID. A partial unique index allows one
   queued/running job per workspace. A retry with the same ID returns its row;
   dispatch POST retries are disabled. Unknown submission outcomes require
   execution-history review before another render.
5. Copy at most 50 MiB of authoritative audio into private lifecycle-managed
   staging, and save an immutable manifest with GCS paths and chosen trim ranges.
6. Run the existing Cloud Run Job with a manifest argument override. The updated
   worker probes real durations, rejects out-of-source trims, normalizes the
   selected video segment, loops only that segment and applies the audio offset.
   Output is vertical 1080×1920 H.264/AAC MP4; source-video audio is discarded.
7. Authorized polling reconciles the operation, verifies output metadata,
   registers the rendered asset and marks success. An interrupted queued job
   expires to failed after five minutes; no automatic re-dispatch occurs.
8. Preview/download requires workspace authorization and a successful job/asset
   record, then issues a private five-minute signed URL. Signed URLs do not
   become stored asset identifiers.

Jobs are associated with the selected audio's existing Studio project. The
current Test Project UI is not a new persisted project editor. The existing
composition PUT endpoint is unchanged; this first export uses an immutable
render manifest rather than that endpoint's one-long-video composition contract.

## Validation

- Request/API tests: same-origin, sign-in, Viewer denial, activation gate,
  unavailable workspace source, stale audio source, scoped manifest, duplicate
  request ID and busy-workspace rejection.
- Seven worker manifest/command tests plus a real FFmpeg synthetic-media test.
  The integration creates red/blue input, selects only the blue segment and
  verifies a three-second looped MP4 with AAC audio and a blue frame near the end.
  No private footage or cloud job is used by this test.
- Existing private Storage upload/preview signing regression passed after auth
  helper extraction.
- TypeScript, targeted strict ESLint and production build passed (65 pages).
- Isolated browser fixture tests actual Export component source against mocked
  APIs: source choices load; Generate submits correct ranges; controls disable
  while running; polling reaches succeeded; no browser warnings/errors.
  This is UI verification, not evidence of a completed Production render.

Optional actual FFmpeg test:

```sh
FFMPEG_TEST_BINARY=/path/to/ffmpeg python3 -m unittest render-worker/tests/test_renderer.py
```

## Production activation checklist

The implementation slice was local-only. The subsequently approved activation
is recorded below.

1. Review/apply `20261116182010_serialize_studio_render_jobs.sql` after checking for
   existing active-job duplicates. Read-only inspection found no render jobs.
2. Build the updated worker and update only the existing Frankfurt Cloud Run Job
   to the reviewed image. Keep its service account, private bucket environment,
   CPU/memory and timeout. Do not reapply lifecycle changes merely to ship code.
3. Inspect effective runtime permissions before adding any grants. The job's
   directly attached IAM policy is empty. Project-level inspection through the
   connector failed because the Cloud Resource Manager API is disabled; inherited
   permissions have not been verified. Do not enable another API implicitly.
   Needed: `run.jobs.run`, `run.jobs.runWithOverrides` for the exact render job,
   plus `run.operations.get` for polling. A job-scoped
   `roles/run.jobsExecutorWithOverrides` grant does not itself include operation
   reads; use an appropriately scoped observer permission if missing.
4. Set Production-only `ADSTUDIO_RENDER_ENABLED=true` and confirm region/job/
   render bucket configuration. No Production identity is copied to Preview.
5. Prepare reviewed app commits in GitHub Desktop; the user performs the push.
   Verify the exact commit reaches READY on Production.
6. Execute **one** approved desktop-asset render, verify job → output object →
   rendered asset row → private playback/download. Inspect duration and codecs.
   Test Viewer denial and another workspace's inability to access its output.

Rollback: set `ADSTUDIO_RENDER_ENABLED=false` to block new submissions. Preserve
job records/outputs for diagnosis; do not delete data or cancel paid executions
without checking the live execution state. The additive index can remain.

References:

- [Cloud Run job execution/overrides](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs/run)
- [Cloud Run operation polling](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.operations/get)
- [Cloud Run role permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/run)
- [FFmpeg input/loop/trim options](https://ffmpeg.org/ffmpeg.html)

## Activation progress

Activation was explicitly approved after the development slice.

- Supabase plugin connection verified healthy. Migration `20261116182010` was
  applied after confirming zero queued/running jobs. Local filename matches
  the remote migration history.
- Worker build `1785cf66-db1f-48a8-929e-7d60ebe726de` succeeded. Existing job
  image updated to digest
  `sha256:cb84a84c77395f57e232d59a6d715d220e20ff12a3fdaad94395c34f3c2492de`;
  job reports Ready with existing Python command, buckets and 2 CPU/4 GiB.
- Production region/job/render-bucket configuration created in Vercel.
  `ADSTUDIO_RENDER_ENABLED=true` is now scoped to Production; a new app
  deployment is required for the setting and implementation.
- Created custom operation reader role containing only `run.operations.get`.
  Bound it to the runtime service account after explicit confirmation.
  The exact render job now grants `roles/run.jobsExecutorWithOverrides` to
  that same account; independent connector policy readback verified the binding.
- No render execution started. App commit/push and end-to-end verification remain.

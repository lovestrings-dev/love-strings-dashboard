# ArtistDeck Studio — implementation handover

## Product target

Build ArtistDeck Studio as a protected `/studio` area inside this existing
Next.js app. Reuse its Supabase Auth, active-workspace model, and workspace
permissions; do not create a second standalone application.

First-release workflow:

1. Select an audio clip from Production.
2. Search/select vertical stock video through Pexels.
3. Add text and optional image overlay.
4. Render a vertical video variation.
5. Show a private, browser-streamable preview and allow a download.

Meta campaign creation is explicitly a later phase. Preserve the rendered-file
contract so it can be reused there.

## Current project state

Repository: `lovestrings-dev/love-strings-dashboard`
Local root: `/Users/sun_mac_m1/Documents/LOVE STRINGS/LS_AI_DASHBOARD`

The current branch is `main`. Latest Studio commit:

```text
280d508 fix(studio): refine beta audio editing
```

It is a clean local commit that has **not yet been pushed** to GitHub. GitHub
Desktop is authenticated and reports one local commit waiting to push. Pushing
`main` triggers the existing Vercel deployment; do not push/deploy, invoke the
Cloud Run Job, or modify cloud configuration without explicit authorization.

The Studio ideas/PDFs are reference-only, outside this Git repository:

- `/Users/sun_mac_m1/Documents/ArtistDeckApp/Studio/UI_IDEAS/`
- `/Users/sun_mac_m1/Documents/ArtistDeckApp/Studio/Meta Ads Video App Planning.html`

## Completed Google Cloud foundation

Project:

- Name: `ArtistDeck-Studio`
- ID: `project-eda6605c-73e6-4361-9ad`
- Number: `1023633877337`
- Region: `europe-west3` (Frankfurt)

Existing private resources:

- Staging bucket: `gs://adstudio-staging-1023633877337`
- Render bucket: `gs://adstudio-renders-1023633877337`
- Artifact Registry Docker repository: `adstudio` in `europe-west3`
- Runtime service account:
  `adstudio-service@project-eda6605c-73e6-4361-9ad.iam.gserviceaccount.com`

The service account has bucket-level `roles/storage.objectUser` on both Studio
buckets. No JSON service-account key was created. Keep it that way. The
buckets must remain private; previews/downloads must use short-lived signed
URLs created only by authorised server code.

### Vercel workload identity for private uploads

The production Vercel workload identity is now permitted to impersonate the
Studio service account, using the provider's single production-project subject:

`owner:lovestrings-dev:project:love-strings-dashboard:environment:production`

The Studio service account also has its self-scoped
`roles/iam.serviceAccountTokenCreator` grant, solely so authorised server code
can sign short-lived Cloud Storage upload, preview, and download URLs. No
service-account key was created. IAM propagation can take a few minutes after
the 2026-11-15 policy change.

This completes the cloud access prerequisite. The Next.js server exchanges
Vercel's OIDC token through the existing workload-identity provider and
exposes a protected direct-upload signing route; it never proxies video bytes
through Vercel and never adds browser credentials. Vercel must provide
`ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE` and
`ADSTUDIO_GOOGLE_SERVICE_ACCOUNT_EMAIL` as server-only environment variables.

Cloud Run, Cloud Build, Artifact Registry, and Cloud Storage APIs are enabled.

## Completed render worker

Files currently added/modified in the working tree:

- `render-worker/renderer.py` — one-manifest Cloud Run Job worker
- `render-worker/Dockerfile` and `requirements.txt`
- `render-worker/render-request.example.json` — stable first-release contract
- `render-worker/staging-lifecycle.json` — delete temporary media/manifests
  after 7 days
- `render-worker/tests/test_renderer.py`
- `scripts/deploy-adstudio-render-worker.sh`
- `.env.example` and `.gitignore`

Worker behaviour:

- Receives `--manifest-uri gs://...` in the private staging bucket.
- Validates all source/overlay URIs remain in the staging bucket and the MP4
  output remains in the render bucket.
- Restricts duration to 1–180 seconds and sanitises overlay text/filter values.
- Uses FFmpeg to output a vertical 1080×1920 H.264/AAC MP4 with `faststart`
  metadata for progressive browser playback.
- Writes output only to the private render bucket.

Local validation already passed:

```bash
python3 -m unittest render-worker/tests/test_renderer.py
bash -n scripts/deploy-adstudio-render-worker.sh
git diff --check
```

The worker is deployed as the private `adstudio-ffmpeg-renderer` Cloud Run Job
in `europe-west3`. It is Ready, uses the dedicated runtime service account,
has one task/one retry and a 20-minute timeout, and has not yet run a render.

The deployment command remains available for intentional worker updates:

```bash
bash scripts/deploy-adstudio-render-worker.sh
```

It applies the staging 7-day lifecycle rule, builds with Cloud Build, and
updates the `adstudio-ffmpeg-renderer` Cloud Run Job. It does not start a
rendering execution.

## Current Studio UI and data contracts (2026-11-14)

The Studio UI currently lives as in-page state in `app/page.tsx`; it is not
yet route-based. `Test Project` has these UI steps: Compose, Audio, Video,
Overlay image, Overlay Text, and Export.

### Audio is the reference implementation

- Production MP3 sources are workspace-scoped `studio_audio_assets` records
  linked through `studio_projects`. The current source URL is Cloudinary and
  is registered through protected server routes.
- `app/components/audio-player.tsx` is the reusable compact source/snippet
  player. Optional `clipStartSeconds` and `clipEndSeconds` constrain seeking,
  duration display, playback start, and automatic stop/reset to an excerpt.
- `app/components/media-trimmer.tsx` is the reusable trim transport. It
  already accepts `mediaType="video"`, but its present visual treatment is a
  waveform; a video implementation must provide a real video frame preview.
- A saved Audio snippet is currently a **local Test Project draft record**,
  not a rendered/cut file: `{ id, songId, title, sourceUrl, sourceFileName,
  artworkUrl, start, end }`. The ID is source + start + end; a duplicate
  replaces the prior local entry. Snippets survive in-app Studio navigation
  and Settings round trips during the active app session, but do not yet
  survive a full page reload.
- Audio UI now has three cards across: Production sources, a local live
  composition preview, and bounded trimmed-audio players. The full-width
  trimmer stays underneath. The default project duration is **15 seconds**;
  30 seconds and custom remain available.
- `MediaTrimmer` has a 1×–6× zoom control. At fixed 15s/30s duration, the
  playback scrubber is intentionally absent so pointer/finger dragging moves
  the excerpt window. The decorative waveform scales and translates beneath
  that selection window. In custom-duration mode, the playback scrubber and
  start/end controls remain available.
- The Live Composition preview is no longer a dummy toggle: once a snippet
  exists it plays the first saved snippet only within its start/end timestamps,
  and animates the `YOUR STORY` artwork while playing.
- On mobile, the Studio waterfall opens immediately on Studio selection and
  closes on a tap outside it.

### Video UI is still placeholder-only

`StudioVideoEditor` in `app/page.tsx` currently uses hard-coded clip cards.
It has no Pexels request, no persisted video asset, no video trim record, no
real preview media, and no render-job integration. Replace this demo data;
do not treat it as a backend contract.

## Handover brief: Video infrastructure and render preparation

Use this as the starting brief for the backend/video-development chat:

> Build the Studio Video and Export foundation inside the existing ArtistDeck
> app. Preserve the current Studio UI flow, the Audio-only production beta,
> and the multi-workspace security model. Treat Audio snippets as the
> interaction reference: a snippet is metadata describing a source asset plus
> start/end seconds, not a newly cut media file. Audio snippets are currently
> session-local; establish the durable project-composition model required for
> both Audio and Video before Export relies on them. Implement the equivalent
> durable model for video clips, then prepare the Export step to turn selected
> audio/video snippets into validated FFmpeg render-job instructions.
>
> Scope:
> 1. Add server-only Pexels search/detail integration. Keep `PEXELS_API_KEY`
>    server-side; never expose it to the browser.
> 2. When a user selects Pexels footage, have authorised server code ingest
>    the actual file into the private Studio staging bucket. Persist a
>    workspace-owned video-source asset with provenance/metadata. Do not pass
>    a Pexels URL directly to the browser renderer or FFmpeg.
> 3. Add workspace-scoped migrations and protected routes for Studio video
>    source assets and video snippets. A video snippet must at minimum retain
>    source asset ID, start, end, clip dimensions/duration, and ordering or
>    selection metadata needed by Export. Preserve tenant/RLS boundaries.
> 4. Reuse the `MediaTrimmer` interaction contract or introduce a compatible
>    video trimmer with actual video-frame preview. It must respect the shared
>    15s/30s/custom project-duration constraints and preserve the mobile
>    zoom/pan precision model: choose range → save metadata snippet → replay
>    only that range.
> 5. Define a versioned export-composition contract which references saved
>    audio/video snippets, overlay data, duration/format, and deterministic
>    ordering. The app must validate and stage every referenced asset, write a
>    GCS manifest, create a render-job database record, and execute the
>    existing private Cloud Run FFmpeg Job.
> 6. Add signed, workspace-authorised preview/download URLs and render status
>    polling. Do not make buckets public or expose GCP/Pexels/Cloudinary
>    secrets.
>
> Start with data model/API contracts and tests before replacing the Video UI
> placeholders. Keep user-facing Studio design changes constrained to the
> current design system, and leave the already deployed Audio flow functional.

## Next implementation phase

Implement the Studio app layer before exposing new Video/Export UI:

1. Add workspace-scoped Supabase migrations for render jobs and rendered
   assets. Include status, requested-by user, manifest URI, output object path,
   failure message, timestamps, and optional Production audio/source references.
2. Implement protected server routes that:
   - resolve active workspace membership;
   - accept/validate Studio render configuration;
   - ingest Pexels media into the staging bucket (never have the browser send a
     Pexels URL directly to FFmpeg);
   - create the GCS manifest;
   - execute the Cloud Run Job with its manifest argument;
   - expose job state; and
   - return short-lived signed preview/download URLs only for the authorised
     workspace.
3. Add Pexels server-side API integration. Store `PEXELS_API_KEY` only as a
   server-side environment variable. Never send it to the browser.
4. Build `/studio` UI using the app's existing dark ArtistDeck shell:
   audio → footage → overlay → render/preview. It must work on mobile and
   desktop.
5. Add deterministic tests for tenant isolation, manifest/object-path
   validation, and signed URL authorisation.

Recommended milestone order:

1. Inspect and document the current `studio_projects` / `studio_audio_assets`
   migrations and server-route authorization conventions.
2. Add a versioned project-composition schema that can persist Audio snippet
   metadata and future Video snippets without breaking the current session UI.
3. Add Pexels search + authorised staging-bucket ingestion, then Video source
   and snippet routes with tenant-isolation tests.
4. Replace only the hard-coded `StudioVideoEditor` placeholder with the real
   asset library, video preview, trimmer, and saved-snippet UI.
5. Add Export composition validation, render-job records, manifest staging,
   Cloud Run Job execution, status polling, and private signed output URLs.
6. Add overlays only after the composition/export contract is stable.

## Important constraints

- Follow the existing multi-workspace invariant: no Love Strings-only logic or
  workspace-name checks.
- Keep the buckets private. Do not add public IAM, public ACLs, or long-lived
  credential files.
- Use the existing service-role/server-route conventions. Do not put service
  keys, Pexels keys, or signing credentials in `NEXT_PUBLIC_*` variables.
- Video render failures should update the database job status and remain
  inspectable without revealing raw internal GCP errors to regular users.
- The Google Cloud MCP connection is currently not usable because its OAuth
  flow could not authenticate. Cloud Shell remains the working route for GCP
  operations.

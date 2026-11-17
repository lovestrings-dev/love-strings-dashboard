# Local Studio cloud rendering

Local Next.js uses the existing private staging/output buckets and Cloud Run renderer. The FFmpeg worker remains in Google Cloud; the local app submits the manifest and previews the output.

## Authentication

- Vercel CLI 65.16.0 signed in as `lovestrings-dev`; verified project `prj_otqxek2aZ9ROmGzdC6fQqBgLdhvI`, team `love-strings-dashboard`.
- Development-only environment pull supplies a short-lived OIDC token. Only that token is merged into `.env.local`; other pulled settings are not imported.
- User approved provider `vercel-development` in pool `adstudio-vercel`, restricted to exact subject `owner:love-strings-dashboard:project:love-strings-dashboard:environment:development` and audience `https://vercel.com/love-strings-dashboard`.
- User approved Workload Identity User on the existing Studio service account for that exact subject. The production provider condition and production binding are unchanged.
- The connector could create the provider but does not support IAM policy mutation verbs; the approved service-account binding was saved through Cloud Console and independently verified by reading the policy.
- `.env.local`, `.env.studio-oidc.local`, and `.vercel/` are ignored. No service-account key was created.

## Refresh local authentication

From this repository, using the existing signed-in CLI:

```sh
pnpm dlx vercel@65.16.0 env pull .env.studio-oidc.local --environment=development --project=prj_otqxek2aZ9ROmGzdC6fQqBgLdhvI --scope=love-strings-dashboard --yes
node scripts/refresh-studio-local-token.mjs
node scripts/check-studio-local-render.mjs
```

The refresh script verifies the expected development identity and expiry before updating only `VERCEL_OIDC_TOKEN`. The check script lists at most one object per bucket and tests render-job permissions; it starts no jobs and deletes no files. Restart the local dev server if it does not reload changed environment settings.

The local audience is `//iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/providers/vercel-development`. Local project, region, bucket, job and service-account values match `.env.example`. Activation uses the existing `ADSTUDIO_RENDER_ENABLED` switch.

Starting a batch uses the normal workspace retention flow, which removes older cloud results. Preview and download anything to keep before confirming Generate. Source assets remain available.

## Validation

Completed on 17 November 2026, around 12:36 CET:

- Local read-only preflight verified both private buckets and `run.jobs.run` / `run.jobs.runWithOverrides` on the existing renderer.
- Local activation enabled; Generate became available to the signed-in `dimasounder@gmail.com` owner through the existing authorization guard.
- Submitted the saved Pesenka Mamontenka excerpt (104.8–119.8 seconds) with Pixabay video 285663 through localhost Export.
- Cloud Run execution `adstudio-ffmpeg-renderer-cq2jw` rendered job `cf9b9d4e-7984-4696-8a8c-252039c36b69`. Worker logs confirm it downloaded the staged private Pixabay MP4 and audio and completed rendering.
- Output object: `workspaces/00000000-0000-0000-0000-000000000001/studio/renders/cf9b9d4e-7984-4696-8a8c-252039c36b69/final.mp4` in the configured render bucket: video/mp4, 20,282,865 bytes.
- Local app automatically reached Results ready, 1/1 succeeded, showing thumbnail, preview and Download MP4. Browser video metadata reports 15 seconds, 1080×1920, no media error; playback advanced to 8.6 seconds. Browser error log empty.
- The normal new-batch retention flow removed previous results from the workspace history and cloud output set; uploaded source assets remain available. Existing seven-day bucket recovery policy was not modified.
- Saved screenshot: `/private/tmp/artistdeck-local-render-success.jpg`.
- No application deployment, commit, push, database migration, service-account key, or production-provider change.

Automatic approval review rejected an initial Production environment pull because it could copy unrelated secrets. It was not executed; the permitted Development-only pull was used instead.

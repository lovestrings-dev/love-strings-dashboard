# Studio private video uploads — OIDC audit handoff

> Follow-up live inspection: see [the prepared bridge repair](studio-oidc-bridge-repair-2026-11-16.md).
> Google also trusts an outdated owner in its subject condition and service-account
> binding. The custom-audience option below would additionally change Vercel's
> token issuer; the follow-up recommends correcting the existing allowed-audience
> path instead. The audience, exact Production condition and principal binding
> have now been corrected with Dmitrii's approval. Policy readback passed;
> authenticated runtime upload verification is pending. The original audit below
> preserves the pre-repair evidence.

**Status:** blocked before a Cloud Storage signed URL is created. No private media object or shared asset row is created by the failing attempts.

**Scope of this note:** factual audit and a proposed next repair. No Google Cloud, Vercel, Supabase, bucket, credential, deployment, or data change was made while preparing it.

## What is working

- The deployed Video UI accepts desktop and iPhone browser-selected files, extracts local metadata, and can render a local preview.
- The iPhone file chooser works. A web app does not need a permanent Photos-library permission analogous to Instagram: user selection in Safari supplies the file for that upload attempt.
- Workspace-scoped audio snippets already persist across devices.
- The private Studio design is in place: server authorisation, a direct short-lived browser-to-GCS upload, server-side completion/metadata registration, private object previews, and workspace-scoped selection persistence.
- Production deployment is live. The relevant Google/Vercel variables are present only in the Production environment, which is appropriate for the production private-storage identity.

## Present failure: exact evidence

The production runtime logs for `POST /api/studio/video-uploads`, in the **create-signed-upload-url** phase, report:

```text
SigningError: Error code invalid_grant: The audience in ID Token
[https://vercel.com/love-strings-dashboard] does not match the expected audience.
```

This has occurred on both desktop and mobile, on the Production aliases. It happens **before**:

1. a signed PUT URL is returned to the browser;
2. browser-to-GCS upload/CORS could run;
3. the completion route can register `studio_workspace_video_assets` in Supabase.

Consequences:

- The browser-local fallback is expected to show the source only on the device where it was picked. It is not a GCS object and cannot be shared cross-device.
- The mismatch between mobile and desktop selected/recent videos is a consequence of cloud registration not occurring, not a selection-grid defect.
- Current GCS CORS, MOV support, Photos access, selected-video persistence, and Supabase RLS are not the immediate blocker. They should be retested only after the signer succeeds.

## Root cause

The runtime has two distinct audiences which are currently being conflated:

1. **The Google Workload Identity Provider resource audience**, used by Google external-account federation. It normally has the resource form:

   ```text
   //iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/providers/vercel
   ```

2. **The audience embedded in Vercel's OIDC ID token**, which Google verifies against the provider configuration.

Current code uses `ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE` for the Google external-account client but calls `getVercelOidcToken()` without a custom audience. The actual Vercel token therefore carries:

```text
https://vercel.com/love-strings-dashboard
```

Google's provider expects a different audience, hence its `invalid_grant` rejection. This is an identity configuration mismatch, not an iPhone or Cloud Storage upload-policy issue.

The relevant implementation is [`lib/server/adstudio-storage.ts`](../lib/server/adstudio-storage.ts). The current federation path is intentionally keyless and should remain so.

## Related configuration, previously verified

| Area | Current state | Notes |
| --- | --- | --- |
| Google project | `project-eda6605c-73e6-4361-9ad` (number `1023633877337`) | GCP region: `europe-west3`. |
| Runtime service account | `adstudio-service@project-eda6605c-73e6-4361-9ad.iam.gserviceaccount.com` | Do not replace with a downloaded service-account key. |
| WIF provider | pool `adstudio-vercel`, provider `vercel` | issuer is `https://oidc.vercel.com`; principal binding is production-scoped. |
| Staging bucket | `adstudio-staging-1023633877337` | Private, uniform bucket-level access, public-access prevention. |
| Render bucket | `adstudio-renders-1023633877337` | Private. |
| Browser CORS | configured for localhost and production app origins | Must be verified after signing works, but cannot cause the present signing error. |
| Vercel variables | Studio/GCP values exist only in Production | Do not copy the production workload identity into Preview. |
| Asset metadata | `studio_workspace_video_assets`, workspace-scoped | A failing signing call produces no row. |

## Recommended repair strategy

Use the GCP provider-resource audience explicitly and keep the two values separate in code/configuration.

### Recommended option: provider-default audience

1. Inspect the **actual** Google Workload Identity Provider `adstudio-vercel/providers/vercel` audience configuration. Do not infer it from old notes.
2. Configure it for the provider-default audience mode, or confirm that mode is already active.
3. In Vercel OIDC retrieval, request an ID token explicitly for the HTTPS version of the provider resource:

   ```ts
   getVercelOidcToken({
     audience: "https://iam.googleapis.com/projects/1023633877337/locations/global/workloadIdentityPools/adstudio-vercel/providers/vercel",
   })
   ```

4. Preserve the `ExternalAccountClient` audience in its `//iam.googleapis.com/...` resource form.
5. Make the distinction explicit with two environment/config names, for example:

   ```text
   ADSTUDIO_GOOGLE_WIF_PROVIDER_AUDIENCE=//iam.googleapis.com/projects/.../providers/vercel
   ADSTUDIO_VERCEL_OIDC_AUDIENCE=https://iam.googleapis.com/projects/.../providers/vercel
   ```

   Avoid one ambiguous `ADSTUDIO_GOOGLE_WORKLOAD_IDENTITY_AUDIENCE` variable doing both jobs.

### Alternative: allowed-audience mode

Alternatively, configure the Google provider to allow exactly the runtime Vercel token audience currently observed:

```text
https://vercel.com/love-strings-dashboard
```

Then the unparameterized Vercel helper can remain viable. This option must be verified against the actual Vercel project/team OIDC semantics before being applied; the observed production token is the authority here, not a guessed team slug.

## Safe verification sequence after a repair

1. Deploy the code/configuration repair to **Production**.
2. Upload one small portrait MP4 from desktop.
3. Confirm the signer succeeds (no `invalid_grant`), direct PUT returns success, and `complete` creates one `studio_workspace_video_assets` row.
4. Refresh another device in the same workspace: confirm Recent uploads and the selected-video card load from the shared asset record, in the same order.
5. Upload one small iPhone MOV via Safari. Confirm signing, direct PUT, metadata row, thumbnail/preview, and cross-device visibility.
6. Only if direct PUT fails after signing, inspect GCS CORS/preflight and response headers.
7. Confirm a different workspace cannot list, preview, select, or upload into the first workspace's object/metadata scope.

Do not test with a large original iPhone file first: use a short vertical clip so log review and retry are fast.

## Known product limitations and future decisions

- **Staging lifecycle:** the current staging bucket policy expires media/manifests after seven days. This is acceptable for temporary ingest but not for durable edit-source storage unless an asset is promoted, a render is queued/completed within the window, or the lifecycle policy is changed. Decide this before relying on uploaded source files for later FFmpeg jobs.
- **Preview deployments:** Preview intentionally lacks the private GCP/OIDC, Cloudinary and Pixabay credentials. It can render but cannot exercise integrated Studio upload/search flows. Keep it this way, document it as non-integrated, or create a fully isolated Preview identity and bucket. Do not reuse Production credentials in Preview.
- **Codec support:** direct upload stores bytes without transcoding. Browser preview needs a browser-decodable source; downstream FFmpeg must be prepared to normalize iPhone MOV/HEVC and other uploaded codecs.
- **File limits:** current UI accepts MP4/MOV/M4V/WebM up to 500 MB, requires valid finite video metadata, and enforces the selected project orientation.
- **Storage scope:** the implementation is one private bucket namespace with workspace/project metadata and object prefixes, not one physical bucket per workspace. This is safer and operationally simpler while retaining workspace isolation. Per-workspace buckets are not required for cross-device visibility.

## Useful code and deployment references

- Server federation/storage helper: [`lib/server/adstudio-storage.ts`](../lib/server/adstudio-storage.ts)
- Upload, completion and listing API: [`app/api/studio/video-uploads/route.ts`](../app/api/studio/video-uploads/route.ts)
- Asset metadata migration: [`supabase/migrations/202611160002_create_studio_workspace_video_assets.sql`](../supabase/migrations/202611160002_create_studio_workspace_video_assets.sql)
- Client upload/fallback behaviour: [`app/page.tsx`](../app/page.tsx)
- Environment template: [`.env.example`](../.env.example)
- Last deployed diagnostic commit: `9407244` (`fix(studio): diagnose private video upload failures`)

Official implementation references for the next chat:

- [Vercel: OIDC with Google Cloud](https://vercel.com/docs/oidc/gcp)
- [Vercel OIDC API — custom token audience](https://vercel.com/docs/oidc/reference)
- [Google Cloud: Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Google Cloud Storage: signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)

## Handoff prompt

> Continue ArtistDeck Studio private video-storage diagnosis. Read `docs/studio-private-upload-oidc-handoff-2026-11-16.md` first. Do not change GCP/Vercel configuration or deploy without explicit approval. The current production failure occurs during signed-URL creation: Google rejects the Vercel OIDC token because its observed audience is `https://vercel.com/love-strings-dashboard`, while the Workload Identity Provider expects another audience. Inspect the live WIF provider audience configuration and the Vercel OIDC settings, then propose or implement the explicit two-audience repair. Preserve private buckets, production-only identity scope, workspace authorization, and keyless federation. After approval, verify signer → direct PUT → complete metadata row → desktop/mobile cross-device visibility in that order.

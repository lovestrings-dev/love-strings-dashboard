# Instagram Reel publishing foundation

This feature is opt-in and disabled by default. It keeps the existing FStats analytics connection unchanged and stores a second, encrypted publishing authorization tied to the exact selected Facebook Page and linked Instagram professional account.

## Meta setup

1. In Meta app **LS Dashboard - FStatsLogin** (`1601779391517352`), retain the analytics Facebook Login for Business configuration unchanged.
2. Create a second **General / User access token** Facebook Login for Business configuration in the **same app**. In Meta's current UI, select the available user-token permissions `business_management`, `instagram_basic`, `instagram_manage_insights`, `read_insights`, and `instagram_content_publish`; do not edit the analytics configuration. The accepted technical publishing permission is singular (`instagram_content_publish`), even though the Instagram setup page uses the descriptive label “content publishing”. Meta did not permit adding `pages_read_engagement` or `pages_show_list` to this new user-token configuration; the existing analytics connection retains those permissions. A user-token configuration has no fixed asset-selection step; ArtistDeck records the specific Page/Instagram selection at its own authorization start and verifies it again on callback and dispatch.
3. Add the existing callback URL to that configuration: `https://love-strings-dashboard.vercel.app/api/integrations/meta/fstats-login/callback`. Both configurations use this exact redirect URI for authorization and code exchange. The shared callback checks only the hashed, pending server-side OAuth attempt and forwards a publishing attempt to `/api/integrations/meta/fstats-login/publishing/callback`; that handler atomically consumes the one-time state and validates its stored workspace, Admin role, and Page/Instagram binding context.
4. Copy the configuration's numeric ID into `META_FSTATS_PUBLISHING_CONFIG_ID`. Set the test workspace UUID in `INSTAGRAM_REEL_PUBLISHING_TEST_WORKSPACE_IDS`. Keep both `INSTAGRAM_REEL_PUBLISHING_ENABLED=false` and `INSTAGRAM_REEL_MANUAL_DISPATCH_ENABLED=false` until a controlled test is approved.
5. Development mode can test only app-role accounts. Production external accounts require the relevant Meta permission access/review.

## Reliability and lifecycle

- Scheduling copies every selected Studio MP4 to a private, retained publish artifact. The original Studio output is protected from batch retention. Publish artifacts have a 31-day retention marker; a future cleanup job must delete only artifacts with no nonterminal publication and after a documented audit window.
- Jobs bind to the Page and Instagram IDs at scheduling. The dispatcher rechecks the current selection and authorization before any API request; account changes cause failure, never retargeting.
- The SQL claim function uses `FOR UPDATE SKIP LOCKED`, persisted leases, stages, container IDs, and append-only attempts. It expires jobs more than `INSTAGRAM_REEL_MAX_LATENESS_MINUTES` late (default 30), rather than publishing a backlog.
- Container creation is never repeated when an ID exists. Ambiguous publish replies enter `reconciling`; an operator must reconcile the known container before another publish request.
- Captions and schedules are mutable/cancellable only while `scheduled` + `queued`; processing freezes them. The exact caption is snapshotted as `caption_used` at container creation.

## Trial Reels

The UI sends Trial only when explicitly selected and persists `manual` or `ss_performance`. It sends Meta's documented `trial_params.graduation_strategy` (`MANUAL` or `SS_PERFORMANCE`) with the Reel container request. Trial requests are never downgraded to Normal. Meta may reject the request for a particular account/app; that error remains visible on the queued item.

References: [Meta Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing) and [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business).

## Dispatch choice still required

No automatic dispatcher is installed. Vercel Hobby Cron is not suitable for precise daily schedules (and this project must remain free-compatible). The prepared internal endpoint is `POST /api/internal/instagram-reels/dispatch`; it accepts only an exact `X-ArtistDeck-Dispatch-Secret` matching server-only `INSTAGRAM_REEL_DISPATCH_SECRET`, then still requires both publishing and automatic-dispatch flags. A future Google Cloud Scheduler HTTP job should call it every five minutes with that custom secret header. This gives expected dispatch delay of 0–5 minutes plus Meta processing time; the queue's exact `scheduled_for` still governs eligibility.

Cloud Scheduler itself has three free jobs per billing account, so one five-minute job is within its documented allowance. Its HTTP requests still consume the target's Vercel Function usage. The independent scheduler cannot publish while Supabase is paused or unavailable; it should retry on non-2xx responses, while database leases prevent duplicate processing after recovery. Supabase Cron is not currently available in this project: there are no Edge Functions and `pg_cron`/`pg_net` are not installed. Do not create a Scheduler job, store its secret, or enable either dispatch flag without explicit approval.

### Ambiguous-outcome reconciliation

An Admin-only same-origin reconciliation route reads only the persisted Meta media/container identifiers. A confirmed persisted media ID may mark the record published. A container status alone is recorded as audit evidence but is never treated as publication evidence and never triggers another publish call. If a container-creation response was lost before its ID was saved, the record explicitly reports that automatic reconciliation is unavailable. Every operator review appends an attempt record.

## Controlled Normal Reel procedure

1. Apply `20261118130609_create_instagram_reel_publishing_foundation.sql` in the intended environment and deploy the matching application build. Do not enable automatic dispatch.
2. Set all server-only variables, including the publishing configuration ID and a single test workspace UUID allowlist. Publishing is unavailable to every other workspace, even if the global flag is true.
3. Turn on `INSTAGRAM_REEL_PUBLISHING_ENABLED=true` only. In the selected workspace, an Admin selects one completed Studio output, supplies the exact caption, selects **Normal**, and schedules one future time.
4. Use **Enable or reauthorize Instagram publishing**. Confirm Meta grants `instagram_basic`, `pages_read_engagement`, and `instagram_content_publish`, and that ArtistDeck confirms the same selected Page-linked Instagram account it stored at authorization start.
5. Save the schedule, then turn on `INSTAGRAM_REEL_MANUAL_DISPATCH_ENABLED=true` briefly. As the same workspace Admin, invoke the manual dispatcher until the stored container finishes and the publication is marked `published`.
6. Verify the persisted `meta_media_id` and retrieve the media permalink from Meta before treating the test as accepted. Turn manual dispatch back off. Leave `INSTAGRAM_REEL_AUTOMATIC_DISPATCH_ENABLED=false`.
7. Trial Reels are a separate approved test; do not use Trial for this Normal-Reel acceptance.

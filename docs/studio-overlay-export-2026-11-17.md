# Studio overlay export — 17 November 2026

The local Studio workflow saves a shared overlay composition and previews it with the selected audio/video pair in Export’s Generate step. Generation freezes that composition for every pair in the batch and flattens its layers into the output MP4.

## Composition contract

`lib/studio/overlays.ts` defines schema version 2: up to eight ordered layers with independent center coordinates, scale, opacity, blur and in/out points. Text has its own content, font size, background and outline. Images reference workspace Production artwork, a private uploaded asset, or the bundled platform-logo image. The initial composition contains OUT NOW, cover art and five actual platform marks.

`studio_workspace_selection_drafts` stores `overlay_composition` and `overlay_revision`. The additive migration is `20261117151741_studio_overlay_compositions.sql` and has been applied. Existing RLS remains enabled. Protected APIs authorize workspace access and use revision compare-and-swap to reject stale saves. Existing browser drafts migrate once when the shared record is empty.

## Preview and render

The server validates image ownership and rasterizes layers with Sharp and bundled Noto Sans. Browser preview and FFmpeg receive the same transparent PNG pixels. The preview transport synchronizes the chosen audio excerpt, looping video trim and timed layers. Uploaded GIFs use their first frame.

The first render request must match the saved composition revision. Each job stores an immutable snapshot; later batch requests use that snapshot even if the draft changes. Request-scoped PNGs are staged privately, and the manifest contains `overlay_schema_version: 2` and ordered `overlay_layers`. Existing staging lifecycle cleanup applies. Permanent uploaded overlay sources use a separate source prefix.

The worker downloads each PNG, centers it at normalized coordinates, applies its time window and composites in stack order. Audio mapping accounts for additional image inputs. Legacy requests remain supported. The existing owner-only generation authorization and batch output-retention rules remain in effect.

## Worker deployment

Cloud Build `203693c1-9a01-448f-8545-c6221b8991aa` built and tested the worker. With explicit user approval, the existing `adstudio-ffmpeg-renderer` job in `europe-west3` was updated to:

`europe-west3-docker.pkg.dev/project-eda6605c-73e6-4361-9ad/adstudio/ffmpeg-renderer@sha256:3f9bf5d922f9781133f646354daa2b1ee11a55c94636772fdb1979d4377143f2`

The job reports Ready. Its previous image digest, for an explicitly authorized rollback, is `sha256:cb84a84c77395f57e232d59a6d715d220e20ff12a3fdaad94395c34f3c2492de`.

## Verification

- TypeScript and targeted ESLint passed.
- Overlay validation, source isolation, stale-save rejection, legacy migration, independent styles and actual PNG/JPEG alpha rasterization passed.
- Render authorization/idempotency, immutable batch snapshots, Cartesian pair matching, media retention and Pixabay staging regressions passed.
- Cloud Build ran real FFmpeg tests for looping trims, audio mapping, transparent-layer blending, stack order and timed disappearance.
- Localhost Export preview played audio/video together without media errors. At six seconds, text, cover and actual platform marks are visible; the cover is configured for seconds 3–13.
- With explicit cleanup approval, localhost generated job `0fed9e8f-1ce5-4e87-927c-73718d81fd5f`, execution `adstudio-ffmpeg-renderer-x5xqv`. Cloud Run succeeded in 2m13.52s. The 22,275,552-byte MP4 reports 15s, 1080×1920 and plays without media errors. Browser inspection verified text, cover and logo pixels in the flattened output at six seconds, with the cover absent outside its 3–13s window. The previous result was marked deleted by normal new-batch cleanup; source assets were preserved.

No app deployment, commit or push is included. One composition applies to every selected audio × video pair in this version; per-video composition variants remain future work.

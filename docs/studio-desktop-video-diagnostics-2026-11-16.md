# Desktop Studio video diagnostics — 2026-11-16

Scope: read-only Production/backend diagnosis following the user's desktop
screenshot and report of different internal-browser selections. No upload,
selection edit, deployment, configuration change or database write performed.
Opening the shared preview changed only the current preview in the internal UI.

## IMG_2929.MOV reached private storage

- GCS object: `gs://adstudio-staging-1023633877337/workspaces/00000000-0000-0000-0000-000000000001/studio/uploads/d6fc58f0-5ac2-4725-a5b6-cb26551f55f3.mov`.
- Object created: 2026-11-16 18:09:40 Europe/Vienna.
- Size: 8,385,413 bytes; content type: `video/quicktime`.
- Supabase asset ID: `d6fc58f0-5ac2-4725-a5b6-cb26551f55f3`.
- Metadata row original filename: `IMG_2929.MOV`; same object path and size;
  2160 × 3840; duration 2.733 seconds; created at 18:09:42 Europe/Vienna.
- Existing authenticated internal browser lists the file under Shared uploads.
  Selecting that library item renders Private workspace video. DOM media state
  confirms source is the shared preview API, readyState 4, duration 2.733333,
  dimensions 2160 × 3840, and no media error. Signed URLs were not logged.
- These checks establish upload object, completion registration, listing and
  signed cloud preview. Physical iPhone/cross-workspace tests remain unperformed.
- Vercel reports READY Production deployment `dpl_7dcWfkNqhcd5m5BxFD62MM3N2AV6`.
  Recent upload-error log contains the older 16:48:55 UTC insufficient-scope
  failure on the previous deployment; no later matching error was returned.

## Selection mismatch

Observed without changing the selected-video list:

| Surface | Selected video state |
| --- | --- |
| User desktop screenshot | Four cards: IMG_2927.MOV local, IMG_2928.MOV local, IMG_2929.MOV local, one Pixabay clip |
| Internal browser | Two cards: canvas_1.mp4 local, the same Pixabay clip |
| Shared Supabase draft | `uploaded_video_snippets = []`; one Pixabay clip, ID `197529` |

The shared upload library and Selected videos are different concepts. Cloud
upload succeeded, but IMG_2929 is not in the shared selected-video draft.

## Code findings

1. `confirmedLocalTrims` restores from workspace-keyed browser localStorage;
   local files come from IndexedDB. These cards naturally differ per browser.
   The displayed count combines these local cards with shared uploaded snippets
   and Pixabay selections, so Selected videos is not currently one canonical
   shared project list.
2. `handleLocalVideo` starts cloud upload and IndexedDB save concurrently using
   a temporary local ID. IndexedDB completion replaces that ID in local state,
   but cloud completion maps/removes only the temporary ID. The mapping is
   in-memory and is not restored. Thus a successful upload can retain its
   local selected card and lose the association to the shared asset.
3. Cloud auto-selection checks the captured local-card count and four-slot
   limit. A local card that should be replaced can consume the slot and prevent
   its uploaded counterpart from entering the shared selection list. These are
   code-supported failure paths, not a captured execution trace proving the
   precise callback ordering of this upload.
4. `reuseRecentVideo` always sets the message saying the file remains local
   until private upload is enabled. It does not check for a matching cloud
   asset. The message describes neither actual backend capability nor verified
   upload state and can mislead after successful upload.
5. Shared selections are fetched on mount/workspace change, then PATCHed from
   component state; there is no ongoing refresh/subscription. The API performs
   a read/merge/upsert of a workspace-wide row, with no revision conflict check.
   Other sessions can show stale state or overwrite newer choices. Drafts are
   workspace-scoped, not project-scoped.

Relevant files: `app/page.tsx` StudioVideoStep upload, restoration and selection
effects; `app/api/studio/selection-draft/route.ts`;
`app/api/studio/video-uploads/route.ts` and its `[assetId]/preview` route.

## Proposed next repair (not implemented)

- Give Selected videos a canonical shared order and stable asset IDs; preserve
  local-only drafts separately and reconcile a local card when upload completes.
- Make temporary-to-saved local ID replacement robust against either callback
  order. Do not match files solely by filename.
- Display accurate upload/source state; remove the obsolete enabled wording.
- Protect shared selection updates from stale-session overwrite and choose
  explicit refresh/conflict behavior.
- Clarify whether selections belong to each Studio project before changing
  the existing workspace-wide persistence schema.

Acceptance: the same uploaded asset is selected once, survives refresh, appears
in the same order across two desktop browser sessions, previews from the private
API, and does not displace or overwrite other work during stale-session saves.

# Beta 1.36 — Studio Demo

Prepared 18 November 2026. Version `1.36.0-beta.2`; About label **Beta 1.36**.
Status: coordinated release candidate; 45/45 offline suites, TypeScript, full ESLint, production build and diff check passed locally.

## Follow-up publication — 18 November 2026

- Added **Download all videos**: a single streaming ZIP of completed results currently displayed in Preview, available to workspace users including Viewers. No new generation permission or temporary cloud archive is required.
- Overlay timing now follows Audio project duration across every set, saved composition, preview and FFmpeg staging. Existing 15-second/delayed bounds normalize to the full current duration; overlays remain visible at the preview endpoint.
- Existing cloud outputs are preserved; this publication starts no new render and requires no migration or worker deployment.
- Local archive integrity/access tests passed; live browser archive acceptance was blocked by the browser download gate.

## Included scope

- Four-step Studio Demo: Audio → Video → Overlays → Export. Legacy Compose is removed from the active workflow.
- Compact audio snippets, consistent portrait preview sizing, contained Video framing, inline Pixabay search and collapsible shared-upload history.
- Private shared video assets and workspace-scoped audio/video selections; shared overlay composition API with revision conflict detection.
- Text, square cover art and actual platform-logo image layers; independent video-authored sets with position, scale, opacity and timing.
- Composition preview before generation. Export combines selected audio × video × overlay sets, including cross-video set variants: two of each produces eight outputs.
- Four portrait result columns on desktop, playback/download/delete controls, simplified header/status and no Render history card.
- Updated worker source, licensed local font/logo assets, regression suites, and local-development/cloud-monitoring handoff documents.

## Access and retention

Workspace members with edit permissions can prepare assets and overlay designs. Existing Viewer restrictions remain. Only the server-verified, confirmed `dimasounder@gmail.com` account with a non-Viewer role can start FFmpeg generation or delete generated results/shared video assets. Other workspace members can view and download available results; client input cannot grant generation access.

Starting a new batch removes the preceding generated cloud outputs. Deleting shared video assets removes their cloud objects. Source assets survive normal output cleanup. Download needed results before starting another batch.

## Infrastructure prerequisites

- Overlay migration `20261117151741_studio_overlay_compositions.sql` was already applied to the linked Supabase project during authorized implementation. Preserve existing workspace/RLS configuration.
- Existing Cloud Run job already uses tested overlay worker digest `sha256:3f9bf5d922f9781133f646354daa2b1ee11a55c94636772fdb1979d4377143f2`.
- Preserve existing production server-only Cloud Storage/OIDC/render environment values. Local Development OIDC credentials and `.vercel/` caches must remain ignored and uncommitted.
- This app push does not rebuild/redeploy the worker or apply additional migrations. Verify Vercel's resulting deployment separately.

## Verification

- Release gate: `pnpm run test:beta136-release` (shared-module offline regressions plus Studio media, permissions, batching, retention and overlays).
- Standard TypeScript, full ESLint, production build, and `git diff --check`.
- Prior live acceptance: batch `005def5a-3818-49ce-84e7-6f59f1f15a93` completed eight distinct combinations with one frozen overlay collection; all eight browser players loaded 15-second 1080×1920 videos without media errors.
- Local release smoke: Studio Demo navigation and all eight existing output players loaded after Development credential refresh; all media reported no errors.
- Deployment acceptance: confirm Beta 1.36; check all four steps, asset selections, overlay saves and result playback. A non-owner account must remain unable to generate through both UI and API. Do not start another destructive-retention render solely for release smoke testing.

## Known limits

- iPhone Photos can return an unreadable local file before upload starts; physical-device import reliability is not resolved by this release.
- Audio waveforms are decorative. Current cloud rendering targets vertical MP4 and bounded selected combinations.
- Output retention is workspace-wide. Shared designs use revision checks; concurrent edits can require reloading.

## Rollback

Redeploy the preceding known-good app commit if needed. Preserve shared source assets, render records and additive schema. Worker rollback, if separately necessary, uses prior digest `sha256:cb84a84c77395f57e232d59a6d715d220e20ff12a3fdaad94395c34f3c2492de` and requires explicit authorization.

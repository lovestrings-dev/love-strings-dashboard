# Beta 1.34 release checkpoint

Prepared 14 November 2026. Version `1.34.0-beta.2`; UI **Beta 1.34**.
Status: local release preparation; no push or deployment authorized.

## Scope

- Production can accept and play managed, workspace-scoped MP3 source files. Current audio metadata is registered through the Studio project/audio-asset model and delivered from Cloudinary through protected server code.
- Studio is exposed as a controlled **Audio-only** beta. The final primary-navigation item opens the Test Project tree; Audio is available and every later workflow stage remains visible but locked.
- Studio Audio lists Production MP3 sources, provides reusable player controls, a local visual composition preview, bounded audio trimming, and local parameter-only snippets. The same project navigation is integrated in the desktop sidebar and toggles a readable right-side drawer on mobile.

## Explicit limits

- Snippets describe a source asset and start/end timestamps only. They are not cut media files and remain local to the current Studio view; they do not survive a browser reload.
- No Pexels/video library, video snippets, rendered preview, export, FFmpeg invocation, or advertising-platform handoff is included in this release.
- The displayed waveforms are decorative. No waveform analysis is claimed.

## Data and configuration

- Migration `20261113135755_create_studio_audio_foundation.sql` is already present on the linked production Supabase project (verified 14 November 2026). It adds workspace-scoped `studio_projects` and versioned `studio_audio_assets` read models with authenticated member-read policies.
- Production upload continues to require the existing server-only Cloudinary credentials. No new public environment variables or client dependencies are required.
- The private Studio FFmpeg worker is intentionally untouched and must not be invoked as part of this deployment.

## Local validation

- `pnpm run test:beta134-release`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `git diff --check`
- Local browser smoke: Studio is last in navigation; the Audio page loads Production MP3 sources; the desktop tree persists while Studio is selected; mobile Studio toggles a dark right-side drawer; non-Audio stages cannot be opened.

## Deployment handoff

Push/deploy only after explicit authorization. Before doing so, verify the remote migration status and preserve all existing production environment variables. After deployment, verify the deployed commit and **Beta 1.34** in About ArtistDeck.

Post-deployment acceptance:

1. Sign in as an existing Love Strings member and confirm Studio is the final navigation item.
2. Open Studio on desktop and mobile. Confirm Audio is available, every other stage is locked, and the mobile Studio tab opens/closes the dark right-side drawer.
3. In Production, upload or replace an MP3 on a disposable test song. Confirm the source player, artwork, filename, seek control, and duration render after refresh.
4. In Studio Audio, choose that source, move the preset window or custom trim bounds, save a snippet, and confirm its bounded playback and deletion. Refreshing the page is expected to clear local snippets in this beta.
5. Confirm no video/export controls are reachable and no render worker job is started.

## Rollback

Redeploy the preceding Beta 1.33 application commit if necessary. The Studio audio tables are additive and should remain in place; do not delete Cloudinary audio history or production audio records during rollback.

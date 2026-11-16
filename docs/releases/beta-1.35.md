# Beta 1.35 release candidate — Video editor prototype
Prepared 16 November 2026. Version `1.35.0-beta.1`; UI **Beta 1.35**.
Status: release candidate prepared locally; workspace-isolation repair is included and requires browser acceptance before deployment.

## Scope

- Studio now exposes both Audio and Video in the Test Project workflow tree.
- Video supports vertical Pixabay search, inline source previews, local vertical-video selection, project-duration trimming, and a four-slot selected-video matrix.
- Confirmed video sources can be revisited from their cards and drive the composition-preview source and project timeline.
- Audio and Video share the project duration. The Audio step uses a fixed, centred selection window whose waveform and playback indicator remain aligned at the source boundaries; moving the selection restarts the selected source preview at the selection start.
- The first confirmed video source is available in the Audio live-composition preview.

## Explicit limits

- This is a prototype editor: waveform graphics are decorative and no media files are cut, rendered, or exported.
- Audio snippets and selected Pixabay sources now have a protected, workspace-scoped Studio draft record once migration `202611160001` is applied. The browser-local copy remains a resilience fallback during loading or offline use.
- Local uploaded-video reuse and selected local-video trims remain device-local prototype records. Private Cloud Storage ingest is still required before an uploaded video can be reopened on another device.
- Studio local records are now namespaced by workspace in browser storage and IndexedDB. The previous global prototype records are intentionally not read, so they cannot cross into another workspace.
- The private FFmpeg/render worker remains out of scope and must not be invoked.

## Release gate

Before deployment, apply migration `202611160001`, then verify the workspace-isolation and cross-device selection scenarios below. Old unscoped prototype records intentionally remain excluded.

## Local validation

- `pnpm run test:beta135-release`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `git diff --check`
- Local browser smoke: switch between Audio and Video; add/remove up to four Video sources; choose a fixed Audio selection at each source boundary and confirm playback restarts from its left edge.
- Workspace-isolation smoke: create an Audio snippet and select/upload Video in Love Strings, switch to Romeo, and confirm neither is visible. Create a Romeo snippet/source, switch back, and confirm only Love Strings’ own records appear.

## Deployment handoff

After workspace isolation is implemented and explicitly approved, verify the remote migration status, preserve existing environment variables, deploy the approved commit, and confirm **Beta 1.35** in About ArtistDeck. Then test separate Love Strings and Romeo workspace sessions to confirm no Studio asset or selection crosses workspace boundaries.

## Rollback

Redeploy the preceding Beta 1.34 application commit if necessary. Do not delete Studio media records, Cloudinary assets, or storage data as part of rollback.

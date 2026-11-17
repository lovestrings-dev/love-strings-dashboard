# Per-video overlay sets

Each saved video source now has an independent overlay set in the Overlays editor. The right-hand menu lists every selected source; opening a set switches its background preview and layer controls. Multiple trims of the same source share its set. Text, artwork, opacity, positions, timing and layer inclusion are independent between sources.

Existing designs are preserved: the first opening clones the shared composition into each video's set. Later additions start from that baseline. The workspace JSON stores optional `videoSets` alongside the existing schema-version-2 `layers`, using stable `upload:<asset UUID>` and `pixabay:<provider ID>` identities. Existing columns and RLS are unchanged; no migration is needed. The protected revision/CAS save path persists all sets together and rejects stale writes. Authorizing a save checks the image sources in every set.

Overlay editing remains organized by the video for which a set was created. Export now treats the selected sets as reusable variants: every selected audio × video pair renders once with every selected set. A batch freezes the complete collection once; each request carries its explicit `overlaySetKey`, and the server stages that set’s PNG layers. Two audio excerpts × two videos × two sets produces eight outputs. The existing worker already understands these raster layers, so no worker deployment is needed. Old shared-only compositions retain their baseline fallback.

Validation covers unique bounded source identities, independent edits, immutable 2×2 snapshots, source isolation and correct uploaded/Pixabay manifest staging. TypeScript, targeted ESLint, overlay/render/batch/retention/Pixabay regressions passed. Localhost verified two saved sets, a temporary opacity difference of 96/95 persisted independently, restoration to 96/96, reopening the editor and both Export previews. No new cloud renders, deployment, commit or push.

Previously generated outputs remain in Render history. New previews and the next generated batch use the current per-video settings.

## Upcoming render selection

Export Sources has three native, keyboard-accessible disclosures: Audio, Video and Overlays. Each summary shows its selected count; the lists start collapsed. Audio/video checks choose Cartesian pairs. Overlay checks are per source video and default to included. Unchecking one set removes that variant from every audio/video pair. If all sets are unchecked, one plain output per audio/video pair remains. Each Generate preview can switch between the selected sets. Source designs themselves remain saved and unchanged.

The batch records `overlaySetKey` and an overlay-set label for each variant; plain requests use `includeOverlays: false`. Result details preserve these choices. Server staging skips its PNG layers, and the existing worker receives an empty layer list. Result matching distinguishes plain from overlaid output. An unfinished batch restores its frozen overlay exclusions on reopen. No migration or worker update is required.

## Eight-output plan verification

The approved full Cartesian model uses one `renderCombinations` function for placeholder identities, counts and queue construction. Selections are bounded to two audio excerpts, two videos and two sets (eight requests). Pending queues retain stable IDs across reloads; completed cached four-output queues cannot override a new eight-slot plan. Output matching includes explicit overlay-set identity so another variant cannot fill a missing slot. Each successful job continues to replace its waiting slot with the existing player/download controls.

Tests verify eight unique tuples and requests, 8→4 count changes, zero-set plain output, JSON reload preservation, exact variant matching, rejected unknown set keys and server staging of both cross-video set choices. Localhost verified eight placeholders, Generate 8 videos, 8→4→8 checkbox changes and alternate-set preview. This verification did not launch a cloud batch.

## Live eight-output acceptance

User-approved batch `005def5a-3818-49ce-84e7-6f59f1f15a93` completed across 17–18 November (Vienna time). All eight audio/video/set combinations succeeded with frozen overlay revision 89. Database verification found eight distinct tuples and 109,931,643 output bytes. Every browser player loaded a 15-second 1080×1920 MP4 without media errors; the final player advanced with audio unmuted. The four-column grid shows all eight results with preview, download and delete controls. Existing batch retention replaced previous outputs and preserved sources.

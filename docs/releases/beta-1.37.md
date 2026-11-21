# ArtistDeck Beta 1.37 — Smart Links Phase 2

## Release scope

This beta introduces the authenticated Smart Links management experience:

- Smart Links Library with search, filters, status, destination summaries, and unavailable analytics placeholders.
- Separate creation workflows for Production-song links and standalone links.
- Two-column editor with linked-song inheritance/overrides, destination ordering, lifecycle controls, and a portrait live preview.
- Protected workspace-scoped Smart Links APIs, optimistic concurrency, and Viewer read-only behavior.

## Deliberate limitations

- Public Smart Link landing pages are not part of this beta. A stored Published status does not yet make a public page available.
- Meta Pixel tracking and analytics collection remain future phases. The interface displays no invented metrics.
- The illustrative Library fixture is development-only and cannot activate in a production build.

## Unchanged

- No Supabase schema migration is introduced by this release; Phase 1A/1B are already deployed.
- Studio and other unrelated work are excluded from this integration branch.

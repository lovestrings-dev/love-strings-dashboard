# Source Data

This folder keeps source files that are useful for rebuilding or auditing the Love Strings Dashboard seed data.

## Love Strings ADMIN.xlsx

Source copy: `Love Strings ADMIN.xlsx`

Imported from Dmitrii's local download on 2026-07-07.

Useful sheets:

- `PRODUCTION`: source for the current Production tab UI seed data.
- `RELEASE MEDIA PLAN`: historical source for Marketing campaigns.
- `BUDGET`: source for the current Budget tab UI seed data.
- `ALL SONGS`: future source for broader song catalog metadata.

Current Production mapping:

- One row in `PRODUCTION` becomes one local song card.
- Released songs keep workbook release dates and production deadlines set 14 days before release.
- Future songs use the workbook order and a predicted 3-week release rhythm, with production deadlines 14 days before release.
- Workbook fields such as production comment, vocal lead, BPM, demo time, drums, piano, and violin are stored in production step notes.
- The app is still UI/local-storage only for Production; Supabase schema and persistence are a later step.

Current Budget mapping:

- Rows in `BUDGET` become local ledger lines with date, description, amount, and type.
- Rows that contain both spent and earned values are split into separate ledger lines so totals stay clear.
- Current seeded totals are `2250` earned, `834` spent, and `1416` balance.
- Potential earn is currently `0` and will later come from the Events/Shows tab.
- The app is still UI/local-storage only for Budget; Supabase schema and persistence are a later step.

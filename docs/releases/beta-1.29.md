# Beta 1.29 release checkpoint

Version: `1.29.0-beta.1`; UI: **Beta 1.29**.

## Deployment

Push the prepared commit on `main` through GitHub Desktop. Vercel's existing Git integration performs the deployment. No new environment variables or pending schema migrations are required. Migrations `202610170001`–`202610170003` have already been applied to the linked Supabase project.

The code is prepared locally; this document does not claim a production deployment or post-deployment acceptance.

## Validation

- TypeScript, lint, the production build, and all 14 targeted offline regressions passed. The About Dashboard UI displays Beta 1.29.
- Authenticated live sharing checks passed with disposable source, destination, and unrelated workspaces, including Member share/unshare, Viewer removal, explicit re-share, source updates, RLS isolation, no automatic sharing, and cleanup.
- Browser checks confirmed read-only received cards, recipient unshare preserving the original, corrected attribution placement, and the enabled sharing selector for Dima's Member role in Romeo's workspace.
- Original data hashes matched after the first live sharing validation. No real songs or sharing choices were changed by those tests. Later sharing choices made by the user remain intact.
- Cross-account sharing was confirmed locally by Dmitrii.

## Live smoke checks after Vercel reports Ready

1. Open About Dashboard and confirm **Beta 1.29**.
2. In Production, check equal-width top controls, Produced sorting, independent options/steps panels, and new-song settings/scroll behavior.
3. From a source Member account, share one chosen song. In the destination, verify its attribution and disabled edits; Not shared should remove only the received card. Share it again from the source to restore it.
4. Run Collect stats; check any failure names/reconnect guidance. Try an artwork upload.
5. If testing past-release completion, use a deliberately disposable song: saving a date before today completes all its steps/tasks.

No automatic sharing default exists. Source songs remain canonical; receiving workspaces get a Production-only read-only view. Updates can take up to 30 seconds in an already open Production view, or refresh immediately on re-entry/window focus.

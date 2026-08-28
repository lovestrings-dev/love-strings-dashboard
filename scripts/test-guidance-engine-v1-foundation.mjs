import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { guidanceStatusFromEvaluation } = await import("../lib/guidance.ts");
const steps = (basics, song, google, invite = false) => ({ artistdeck_basics: basics, first_song: song, google_youtube: google, invite_member: invite });
const skipped = (song = false, google = false, invite = false) => ({ artistdeck_basics: false, first_song: song, google_youtube: google, invite_member: invite });

assert.deepEqual(guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, false, false) }), {
  active: true, program: "getting_started_v1", completed: 1, total: 4, nextStep: "first_song", steps: steps(true, false, false), skipped: skipped()
});
const allComplete = guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, true, true, true) });
assert.equal(allComplete.active, true, "all canonical steps remain visible until Close");
assert.equal(allComplete.nextStep, null, "4 of 4 has no further recommended step");
assert.equal(guidanceStatusFromEvaluation({ eligible: true, completedProgram: true, steps: steps(false, false, false) }).active, false, "completed marker short-circuits evaluation");
assert.equal(guidanceStatusFromEvaluation({ eligible: false, completedProgram: false, steps: steps(true, false, false) }).active, false, "mature workspaces are deliberately ineligible");
const googleFirst = guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, false, true) });
assert.equal(googleFirst.nextStep, "first_song", "completion order does not change configured next step");
const independentlyCreatedSong = guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, true, false) });
assert.equal(independentlyCreatedSong.steps.first_song, true, "a real song completes the step without helper interaction");
const skippedSong = guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, false, false), skipped: skipped(true, false) });
assert.equal(skippedSong.nextStep, "google_youtube", "a skipped first-song action advances recommendation without falsifying completion");
assert.equal(skippedSong.completed, 1, "skips do not increase actual completion");
assert.equal(guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, false, false), skipped: skipped(true, true, true) }).active, false, "all remaining skipped actions hide the helper");
const laterSong = guidanceStatusFromEvaluation({ eligible: true, completedProgram: false, steps: steps(true, true, false), skipped: skipped(true, false) });
assert.equal(laterSong.steps.first_song, true, "later canonical completion remains visible after a skip");

const [route, migration, skipMigration, explicitCompletionMigration, inviteMigration, finalizationRepair, conflictRepair] = await Promise.all([
  readFile(new URL("../app/api/guidance/status/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608270002_create_guidance_engine_v1_foundation.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608280001_add_getting_started_guidance_skips.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608280002_make_getting_started_completion_explicit.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608280003_add_getting_started_invite_member_step.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608270003_repair_first_admin_finalization_workspace_id_ambiguity.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202608270004_repair_first_admin_finalization_conflict_target_ambiguity.sql", import.meta.url), "utf8")
]);
assert.match(route, /\.rpc\("get_guidance_status"/, "one compact server RPC backs the client endpoint");
assert.doesNotMatch(route, /production_songs|app_google_connections/, "the endpoint does not fan completion reads out from the client boundary");
assert.match(migration, /guidance_eligible_at = now\(\)/, "only newly finalized workspaces become eligible");
assert.match(migration, /production_songs_invalidate_getting_started_guidance/, "song removal invalidates a completed marker");
assert.match(migration, /app_google_connections_invalidate_getting_started_guidance/, "Google disconnect invalidates a completed marker");
assert.match(migration, /workspace_id, program_key/, "progress is isolated per workspace and program");
assert.match(skipMigration, /skipped_steps jsonb/, "skip state is a compact workspace/program-scoped addition");
assert.match(skipMigration, /skip_getting_started_guidance_step/, "skips are persisted through a narrow Guidance RPC");
assert.match(skipMigration, /not first_song_complete and not coalesce/, "skips do not replace canonical first-song completion");
assert.match(explicitCompletionMigration, /dismiss_getting_started_guidance/, "Close persists through the existing program-progress row");
assert.match(explicitCompletionMigration, /dismissed_at is not null/, "dismissal, not automatic 3\/3, short-circuits the helper");
assert.match(inviteMigration, /invite_member/, "the fourth Guidance step is represented in the status contract");
assert.match(inviteMigration, /app_workspace_invitations as invitation/, "a real workspace invitation completes the fourth step");
assert.match(inviteMigration, /invitation\.created_at >= workspace\.guidance_eligible_at/, "pre-Guidance bootstrap invitations do not complete the step");
assert.match(inviteMigration, /not coalesce\(\(skipped_steps ->> 'invite_member'\)::boolean, false\)/, "Invite Member skip remains separate from canonical completion");
assert.match(finalizationRepair, /where app_workspace_settings\.workspace_id = p_workspace_id;/, "the first-admin finalization repair qualifies the output-variable collision");
assert.match(finalizationRepair, /refusing ambiguous workspace_id repair/, "an unexpected remote definition fails closed rather than being rewritten blindly");
assert.match(conflictRepair, /on conflict on constraint focus_other_tasks_workspace_stable_key_key do nothing;/, "the starter-task conflict target avoids the workspace_id output-variable collision");
assert.match(conflictRepair, /where app_workspace_settings\.workspace_id = p_workspace_id;/, "the comprehensive repair requires the prior settings predicate to remain qualified");
assert.match(conflictRepair, /refusing conflict-target ambiguity repair/, "an unexpected remote definition fails closed rather than being rewritten blindly");
console.log("Guidance Engine V1 foundation tests passed.");

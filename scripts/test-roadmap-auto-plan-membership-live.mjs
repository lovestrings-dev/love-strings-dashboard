import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--apply")) {
  throw new Error("Use --apply to run the approved BIOGLYCERIN Auto-plan membership verification.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function getWorkspace() {
  const { data, error } = await service.from("app_workspaces").select("id").eq("name", "BIOGLYCERIN").single();
  if (error) throw error;
  return data;
}

const workspace = await getWorkspace();
const [{ data: phases, error: phaseError }, { data: songs, error: songError }] = await Promise.all([
  service.from("roadmap_phases").select("id, phase_number").eq("workspace_id", workspace.id).order("phase_number"),
  service.from("production_songs").select("id, title, release_date, roadmap_general_position, roadmap_phase_id").eq("workspace_id", workspace.id).order("roadmap_general_position")
]);
if (phaseError) throw phaseError;
if (songError) throw songError;
if ((phases?.length ?? 0) < 2 || (songs?.length ?? 0) < 3) throw new Error("BIOGLYCERIN needs at least two phases and three Production songs.");

const [firstPhase, secondPhase] = phases;
const [firstSong, secondSong, thirdSong] = songs.slice(-3);
const original = new Map([firstSong, secondSong, thirdSong].map((song) => [song.id, song.roadmap_phase_id]));

async function setPhase(songId, phaseId) {
  const { error } = await service.from("production_songs").update({ roadmap_phase_id: phaseId }).eq("id", songId).eq("workspace_id", workspace.id);
  if (error) throw error;
}

async function memberships(songId) {
  const { data, error } = await service
    .from("roadmap_planning_instance_songs")
    .select("planning_instance_id, roadmap_planning_instances!inner(plan_type)")
    .eq("workspace_id", workspace.id)
    .eq("production_song_id", songId);
  if (error) throw error;
  return data ?? [];
}

try {
  await setPhase(firstSong.id, firstPhase.id);
  await setPhase(secondSong.id, secondPhase.id);
  await setPhase(thirdSong.id, firstPhase.id);

  const assigned = await memberships(firstSong.id);
  const autoMemberships = assigned.filter((membership) => membership.roadmap_planning_instances.plan_type === "auto");
  assert.equal(autoMemberships.length, 1);
  assert.equal(autoMemberships[0].planning_instance_id, firstPhase.id);

  await setPhase(firstSong.id, secondPhase.id);
  const moved = await memberships(firstSong.id);
  const movedAutoMemberships = moved.filter((membership) => membership.roadmap_planning_instances.plan_type === "auto");
  assert.equal(movedAutoMemberships.length, 1, "moving a song between Auto plans left multiple memberships");
  assert.equal(movedAutoMemberships[0].planning_instance_id, secondPhase.id);

  const { error: duplicateError } = await service.from("roadmap_planning_instance_songs").insert({
    planning_instance_id: firstPhase.id,
    production_song_id: firstSong.id,
    workspace_id: workspace.id,
    local_position: null
  });
  assert.ok(duplicateError, "a direct second Auto-plan membership was accepted");
  assert.match(duplicateError.message, /only one Auto plan/i);

  const after = await service.from("production_songs").select("id, release_date, roadmap_general_position").in("id", [firstSong.id, secondSong.id, thirdSong.id]);
  if (after.error) throw after.error;
  for (const song of after.data ?? []) {
    const before = [firstSong, secondSong, thirdSong].find((candidate) => candidate.id === song.id);
    assert.equal(song.release_date, before.release_date, "phase membership changed a canonical Release Date");
    assert.equal(song.roadmap_general_position, before.roadmap_general_position, "phase membership changed a canonical position");
  }

  console.log("Live Auto-plan membership verification passed: single Auto membership, cross-plan reassignment, and canonical-date/position preservation.");
} finally {
  for (const song of [firstSong, secondSong, thirdSong]) await setPhase(song.id, original.get(song.id));
}

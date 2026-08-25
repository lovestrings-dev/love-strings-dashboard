import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--apply")) {
  throw new Error("Use --apply to create the approved BIOGLYCERIN Roadmap test songs.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function workspaceState() {
  const { data: workspaces, error: workspaceError } = await service
    .from("app_workspaces")
    .select("id, name")
    .eq("name", "BIOGLYCERIN")
    .limit(1);
  if (workspaceError) throw workspaceError;
  const workspace = workspaces?.[0];
  if (!workspace) throw new Error("BIOGLYCERIN workspace was not found.");

  const [{ data: settings, error: settingsError }, { data: songs, error: songsError }] = await Promise.all([
    service.from("app_workspace_settings").select("timezone, roadmap_standard_release_cadence_days").eq("workspace_id", workspace.id).single(),
    service.from("production_songs").select("id, title, release_date, roadmap_general_position").eq("workspace_id", workspace.id).order("roadmap_general_position")
  ]);
  if (settingsError) throw settingsError;
  if (songsError) throw songsError;
  return { settings, songs: songs ?? [], workspace };
}

function expectedCreation(state) {
  const latestRelease = state.songs.reduce((latest, song) => !latest || song.release_date > latest ? song.release_date : latest, null);
  const maxPosition = state.songs.reduce((maximum, song) => Math.max(maximum, song.roadmap_general_position), 0);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", month: "2-digit", timeZone: state.settings.timezone || "Europe/Vienna", year: "numeric"
  }).formatToParts(new Date());
  const today = `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}-${parts.find((part) => part.type === "day").value}`;
  const anchor = latestRelease && latestRelease > today ? latestRelease : today;
  return {
    cadenceDays: state.settings.roadmap_standard_release_cadence_days,
    latestRelease,
    position: maxPosition + 1,
    releaseDate: addDays(anchor, state.settings.roadmap_standard_release_cadence_days),
    today
  };
}

async function create(workspaceId, title) {
  const { data, error } = await service.rpc("create_roadmap_aware_production_v1_song", {
    p_title: title,
    p_workspace_id: workspaceId
  });
  if (error) throw error;
  const song = Array.isArray(data) ? data[0] : data;
  if (!song) throw new Error("Creation RPC did not return a song.");
  return song;
}

async function verifyPersisted(song) {
  const [{ data: persisted, error: songError }, { data: steps, error: stepsError }] = await Promise.all([
    service.from("production_songs").select("*").eq("id", song.id).single(),
    service.from("production_steps").select("*").eq("production_song_id", song.id).order("position")
  ]);
  if (songError) throw songError;
  if (stepsError) throw stepsError;
  assert.equal(persisted.release_date, song.release_date);
  assert.equal(persisted.roadmap_general_position, song.roadmap_general_position);
  assert.equal(persisted.roadmap_phase_id, null);
  assert.equal(persisted.scheduling_model, "template-v1");
  assert.equal(persisted.production_template_snapshot.schedulingModel, "template-v1");
  assert.ok(steps.length > 0);
  assert.ok(steps.every((step) => step.status === "not-started"));
  assert.ok(steps.some((step) => step.template_step_kind === "idea_anchor"));
  const distributor = steps.find((step) => step.template_step_kind === "production_step" && step.template_step_stable_key === "distributor-v1");
  if (distributor) {
    assert.equal(distributor.step_deadline, addDays(song.release_date, -distributor.template_step_lead_time_days));
    assert.equal(persisted.production_deadline, distributor.step_deadline);
  }
  return { persisted, stepCount: steps.length };
}

const before = await workspaceState();
const firstExpected = expectedCreation(before);
const first = await create(before.workspace.id, "Roadmap Validation Song 1");
assert.equal(first.release_date, firstExpected.releaseDate);
assert.equal(first.roadmap_general_position, firstExpected.position);
const firstPersisted = await verifyPersisted(first);

const afterFirst = await workspaceState();
const secondExpected = expectedCreation(afterFirst);
const second = await create(afterFirst.workspace.id, "Roadmap Validation Song 2");
assert.equal(second.release_date, secondExpected.releaseDate);
assert.equal(second.roadmap_general_position, secondExpected.position);
const secondPersisted = await verifyPersisted(second);

console.log(JSON.stringify({
  before: { cadenceDays: firstExpected.cadenceDays, latestRelease: firstExpected.latestRelease, songCount: before.songs.length, today: firstExpected.today, highestPosition: firstExpected.position - 1 },
  first: { id: first.id, title: first.title, releaseDate: first.release_date, expectedReleaseDate: firstExpected.releaseDate, position: first.roadmap_general_position, expectedPosition: firstExpected.position, stepCount: firstPersisted.stepCount },
  second: { id: second.id, title: second.title, releaseDate: second.release_date, expectedReleaseDate: secondExpected.releaseDate, position: second.roadmap_general_position, expectedPosition: secondExpected.position, stepCount: secondPersisted.stepCount }
}, null, 2));

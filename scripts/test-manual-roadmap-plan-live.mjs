import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
if (!process.argv.includes("--apply")) throw new Error("Use --apply for the approved BG Manual Plan verification.");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: workspace, error: workspaceError } = await service.from("app_workspaces").select("id").eq("name", "BIOGLYCERIN").single(); if (workspaceError) throw workspaceError;
const { data: songs, error: songError } = await service.from("production_songs").select("id, release_date, roadmap_general_position, roadmap_phase_id, production_deadline").eq("workspace_id", workspace.id).order("roadmap_general_position").limit(3); if (songError || songs.length < 3) throw songError ?? new Error("Need three BG songs.");
const planId = crypto.randomUUID(); const before = structuredClone(songs);
try {
  const { error } = await service.from("roadmap_planning_instances").insert({ id: planId, workspace_id: workspace.id, plan_type: "manual", title: "Temporary Manual Validation", description: "", timeframe_start: "2026-08-25", timeframe_end: "2026-09-25", display_position: 9999 }); if (error) throw error;
  for (const song of songs) { const { error: memberError } = await service.rpc("mutate_manual_roadmap_plan_membership", { p_workspace_id: workspace.id, p_plan_id: planId, p_action: "add", p_song_id: song.id }); if (memberError) throw memberError; }
  let { data: members, error: memberLoadError } = await service.from("roadmap_planning_instance_songs").select("production_song_id, local_position").eq("planning_instance_id", planId).order("local_position"); if (memberLoadError) throw memberLoadError; assert.deepEqual(members.map((m) => m.production_song_id), songs.map((song) => song.id));
  const { error: moveError } = await service.rpc("mutate_manual_roadmap_plan_membership", { p_workspace_id: workspace.id, p_plan_id: planId, p_action: "move", p_song_id: songs[2].id, p_direction: -1 }); if (moveError) throw moveError;
  ({ data: members, error: memberLoadError } = await service.from("roadmap_planning_instance_songs").select("production_song_id, local_position").eq("planning_instance_id", planId).order("local_position")); if (memberLoadError) throw memberLoadError; assert.deepEqual(members.map((m) => m.production_song_id), [songs[0].id, songs[2].id, songs[1].id]);
  const { data: after, error: afterError } = await service.from("production_songs").select("id, release_date, roadmap_general_position, roadmap_phase_id, production_deadline").in("id", songs.map((song) => song.id)); if (afterError) throw afterError; assert.deepEqual(after.sort((a,b)=>a.roadmap_general_position-b.roadmap_general_position), before, "Manual membership affected canonical or Production fields");
  console.log("Live Manual Plan membership/order verification passed without canonical scheduling changes.");
} finally { await service.from("roadmap_planning_instances").delete().eq("id", planId).eq("workspace_id", workspace.id); }

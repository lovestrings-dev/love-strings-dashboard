import type { SupabaseClient } from "@supabase/supabase-js";
import { studioRenderBucketName, studioStorage } from "./adstudio-storage";
import { isStudioUuid, renderObjectPaths } from "../studio/render-request";

export async function purgePreviousStudioOutputs(client: SupabaseClient, workspaceId: string, batchId: string, startBatch: boolean) {
  // The caller must first hold the workspace's unique queued/running job slot.
  renderObjectPaths(workspaceId, batchId);
  const { data: state, error: stateError } = await client.from("studio_render_retention_state").select("batch_id").eq("workspace_id", workspaceId).maybeSingle();
  if (stateError) throw stateError;
  if (!startBatch && state?.batch_id !== batchId) throw new Error("This batch was replaced. Refresh Export before generating again.");
  if (startBatch && state?.batch_id !== batchId) {
    const { error } = await client.from("studio_render_retention_state").upsert({ workspace_id: workspaceId, batch_id: batchId, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  const { data: keep, error: keepError } = await client.from("studio_render_jobs").select("id").eq("workspace_id", workspaceId).eq("batch_id", batchId);
  if (keepError) throw keepError;
  const keepIds = new Set((keep ?? []).map((job) => job.id));
  // Scheduled publishing owns a copied private artifact; retain it even when a
  // newer Studio batch removes its original render output.
  const { data: protectedArtifacts, error: protectedError } = await client.from("studio_publish_artifacts").select("render_job_id").eq("workspace_id", workspaceId);
  // Publishing is optional and its migration may intentionally be pending while
  // the existing Studio renderer is deployed. In that state there can be no
  // publish artifacts to preserve, so do not make unrelated rendering fail.
  // Supabase's REST schema cache reports the same condition as PGRST205,
  // whereas direct PostgreSQL reports 42P01.
  if (protectedError && !["42P01", "PGRST205"].includes(protectedError.code)) throw protectedError;
  for (const artifact of protectedArtifacts ?? []) keepIds.add(artifact.render_job_id);
  const prefix = `workspaces/${workspaceId}/studio/renders/`;
  const storage = await studioStorage();
  const [files] = await storage.bucket(studioRenderBucketName()).getFiles({ prefix });
  const stale = files.filter((file) => {
    if (!file.name.startsWith(prefix)) throw new Error("Unexpected render object path.");
    const id = file.name.slice(prefix.length).split("/")[0];
    if (!isStudioUuid(id)) throw new Error("Unexpected render object identity.");
    return !keepIds.has(id);
  });
  // Hide only unprotected stale links before removing blobs. A scheduled Reel
  // owns its source artifact and must remain reachable for audit/recovery.
  const { data: allJobs, error: allJobsError } = await client.from("studio_render_jobs").select("id,batch_id").eq("workspace_id", workspaceId).is("deleted_at", null);
  if (allJobsError) throw allJobsError;
  const markIds = (allJobs ?? []).filter((job) => job.batch_id !== batchId && !keepIds.has(job.id)).map((job) => job.id);
  if (markIds.length) {
    const { error: markError } = await client.from("studio_render_jobs").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspaceId).in("id", markIds);
    if (markError) throw markError;
  }
  for (const file of stale) await file.delete({ ignoreNotFound: true });
}

export async function deleteStudioRenderObject(workspaceId: string, jobId: string, objectPath: string) {
  if (objectPath !== renderObjectPaths(workspaceId, jobId).output) throw new Error("Invalid render output path.");
  const storage = await studioStorage();
  await storage.bucket(studioRenderBucketName()).file(objectPath).delete({ ignoreNotFound: true });
}

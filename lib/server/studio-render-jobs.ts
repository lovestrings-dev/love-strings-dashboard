import type { SupabaseClient } from "@supabase/supabase-js";
import { studioGoogleAuthClient, studioRenderBucketName, studioStorage } from "./adstudio-storage";

type Operation = { name?: string; done?: boolean; error?: { message?: string }; response?: { succeededCount?: number; conditions?: Array<{ type?: string; state?: string }> } };
export type StudioRenderJob = { id: string; workspace_id: string; studio_project_id: string; status: string; provider_execution_id: string | null; output_object_path: string; failure_message: string | null; created_at: string };

function cloudRunConfig() {
  const project = process.env.ADSTUDIO_GCP_PROJECT_ID;
  const region = process.env.ADSTUDIO_GCP_REGION;
  const job = process.env.ADSTUDIO_RENDER_JOB;
  if (!project || !region || !job || ![project, region, job].every((v) => /^[a-z0-9-]+$/.test(v))) throw new Error("Studio rendering is not configured.");
  return { root: `projects/${project}/locations/${region}`, job: `projects/${project}/locations/${region}/jobs/${job}` };
}

export async function dispatchStudioRender(manifestUri: string) {
  const config = cloudRunConfig();
  const auth = studioGoogleAuthClient(["https://www.googleapis.com/auth/cloud-platform"]);
  const { data } = await auth.request<Operation>({
    url: `https://run.googleapis.com/v2/${config.job}:run`, method: "POST", retry: false, timeout: 30000,
    data: { overrides: { taskCount: 1, containerOverrides: [{ args: ["/app/renderer.py", "--manifest-uri", manifestUri] }] } }
  });
  if (!data.name || !data.name.startsWith(`${config.root}/operations/`)) throw new Error("Render dispatch did not return an operation.");
  return data.name;
}

export async function refreshStudioRenderJob(client: SupabaseClient, job: StudioRenderJob) {
  if (job.status === "queued" && Date.now() - Date.parse(job.created_at) > 5 * 60 * 1000) {
    const failure = "Render preparation was interrupted. Check the execution history before starting a new render.";
    const { error } = await client.from("studio_render_jobs").update({ status: "failed", failure_message: failure, completed_at: new Date().toISOString() }).eq("workspace_id", job.workspace_id).eq("id", job.id).eq("status", "queued");
    if (error) throw error;
    return { ...job, status: "failed", failure_message: failure };
  }
  if (job.status !== "running" || !job.provider_execution_id) return job;
  const { root } = cloudRunConfig();
  if (!job.provider_execution_id.startsWith(`${root}/operations/`) || !/^[a-zA-Z0-9_/-]+$/.test(job.provider_execution_id)) throw new Error("Invalid render operation.");
  const auth = studioGoogleAuthClient(["https://www.googleapis.com/auth/cloud-platform"]);
  const { data } = await auth.request<Operation>({ url: `https://run.googleapis.com/v2/${job.provider_execution_id}`, method: "GET", timeout: 15000 });
  if (!data.done) return job;
  const succeeded = !data.error && ((data.response?.succeededCount ?? 0) > 0 || data.response?.conditions?.some((c) => c.type === "Completed" && c.state === "CONDITION_SUCCEEDED"));
  if (!succeeded) {
    const failure = "The render worker could not finish this video. Check the render execution logs before retrying.";
    const { error } = await client.from("studio_render_jobs").update({ status: "failed", failure_message: failure, completed_at: new Date().toISOString() }).eq("workspace_id", job.workspace_id).eq("id", job.id).eq("status", "running");
    if (error) throw error;
    return { ...job, status: "failed", failure_message: failure };
  }
  const storage = await studioStorage();
  const [metadata] = await storage.bucket(studioRenderBucketName()).file(job.output_object_path).getMetadata();
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size <= 0 || metadata.contentType !== "video/mp4") throw new Error("Render output could not be verified.");
  // Final registration precedes success. Repeated polling is idempotent.
  const { error: assetError } = await client.from("studio_rendered_assets").upsert({ workspace_id: job.workspace_id, studio_project_id: job.studio_project_id, render_job_id: job.id, object_path: job.output_object_path, mime_type: "video/mp4", byte_size: size, width: 1080, height: 1920 }, { onConflict: "render_job_id" });
  if (assetError) throw assetError;
  const { error } = await client.from("studio_render_jobs").update({ status: "succeeded", completed_at: new Date().toISOString() }).eq("workspace_id", job.workspace_id).eq("id", job.id).eq("status", "running");
  if (error) throw error;
  return { ...job, status: "succeeded" };
}

export function toStudioRenderReply(job: StudioRenderJob) {
  return { id: job.id, status: job.status, error: job.failure_message, createdAt: job.created_at, previewUrl: job.status === "succeeded" ? `/api/studio/render-jobs/${job.id}/preview` : null };
}

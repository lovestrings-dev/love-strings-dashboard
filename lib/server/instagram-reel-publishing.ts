import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptMetaTokenPayload, encryptMetaTokenPayload } from "@/lib/meta/tokens";
import { discoverFstatsLoginFacebookPages, discoverFstatsLoginLinkedInstagram } from "@/lib/meta/fstats-login-oauth";
import { studioRenderBucketName, studioStorage } from "./adstudio-storage";
import { shouldExpireUnstartedPublication } from "@/lib/instagram-reel-schedule";

export const instagramPublishingCapability = "instagram_reel_publish";
export const instagramPublishingScopes = ["instagram_basic", "instagram_content_publish", "pages_read_engagement"] as const;
export const maxInstagramReelBatch = 30;

export function instagramReelPublishingTestWorkspaceIds() {
  return new Set((process.env.INSTAGRAM_REEL_PUBLISHING_TEST_WORKSPACE_IDS ?? "").split(",").map((value) => value.trim()).filter((value) => /^[0-9a-f-]{36}$/i.test(value)));
}
export function instagramReelPublishingEnabled(workspaceId?: string) {
  return process.env.INSTAGRAM_REEL_PUBLISHING_ENABLED === "true" && !!workspaceId && instagramReelPublishingTestWorkspaceIds().has(workspaceId);
}
export function manualInstagramReelDispatchEnabled() { return process.env.INSTAGRAM_REEL_MANUAL_DISPATCH_ENABLED === "true"; }
export function instagramReelMaximumLatenessMinutes() {
  const n = Number(process.env.INSTAGRAM_REEL_MAX_LATENESS_MINUTES ?? 30);
  return Number.isFinite(n) && n >= 1 && n <= 24 * 60 ? Math.floor(n) : 30;
}

export type PublishingTarget = { connectionId: string; pageExternalId: string; instagramExternalId: string };

export async function selectedPublishingTarget(client: SupabaseClient, workspaceId: string): Promise<PublishingTarget> {
  const { data: connection, error } = await client.from("app_meta_connections").select("id").eq("workspace_id", workspaceId).eq("connection_kind", "fstats_login_facebook_page").eq("connection_state", "connected").maybeSingle();
  if (error || !connection) throw error ?? new Error("Connect Facebook Page statistics before enabling Instagram publishing.");
  const { data: mappings, error: mappingError } = await client.from("app_meta_connection_accounts").select("id,platform_account_id,parent_platform_account_id,account_type,is_selected,asset_state").eq("workspace_id", workspaceId).eq("connection_id", connection.id).eq("is_selected", true).eq("asset_state", "selected");
  if (mappingError || !mappings || mappings.length !== 2) throw mappingError ?? new Error("Choose one linked Facebook Page and Instagram account first.");
  const ids = mappings.map((row) => row.platform_account_id);
  const { data: accounts, error: accountsError } = await client.from("platform_accounts").select("id,meta_external_id,platform_id").eq("workspace_id", workspaceId).in("id", ids);
  if (accountsError || !accounts || accounts.length !== 2) throw accountsError ?? new Error("The selected Meta accounts are no longer available.");
  const { data: platforms, error: platformsError } = await client.from("platforms").select("id,slug").in("id", accounts.map((row) => row.platform_id));
  if (platformsError) throw platformsError;
  const slugFor = new Map((platforms ?? []).map((row) => [row.id, row.slug]));
  const pageMapping = mappings.find((row) => row.account_type === "facebook_page");
  const instagramMapping = mappings.find((row) => row.account_type === "instagram_professional");
  const page = accounts.find((row) => row.id === pageMapping?.platform_account_id && slugFor.get(row.platform_id) === "facebook");
  const instagram = accounts.find((row) => row.id === instagramMapping?.platform_account_id && slugFor.get(row.platform_id) === "instagram");
  if (!page?.meta_external_id || !instagram?.meta_external_id) throw new Error("The selected Page/Instagram binding is incomplete.");
  if (instagramMapping?.parent_platform_account_id !== pageMapping?.platform_account_id) throw new Error("The selected Instagram account is not linked to the selected Facebook Page.");
  const [{ data: pageBinding, error: pageBindingError }, { data: instagramBinding, error: instagramBindingError }] = await Promise.all([
    client.from("app_meta_active_page_bindings").select("external_id,mapping_id").eq("workspace_id", workspaceId).eq("connection_id", connection.id).eq("external_id", page.meta_external_id).maybeSingle(),
    client.from("app_meta_active_instagram_bindings").select("external_id,mapping_id,parent_page_external_id").eq("workspace_id", workspaceId).eq("connection_id", connection.id).eq("external_id", instagram.meta_external_id).maybeSingle()
  ]);
  if (pageBindingError || instagramBindingError || !pageBinding || !instagramBinding || pageBinding.mapping_id !== pageMapping?.id || instagramBinding.mapping_id !== instagramMapping?.id || instagramBinding.parent_page_external_id !== page.meta_external_id) throw new Error("The selected Instagram account is not bound to the selected Facebook Page.");
  return { connectionId: connection.id, pageExternalId: page.meta_external_id, instagramExternalId: instagram.meta_external_id };
}

export async function savePublishingAuthorization(client: SupabaseClient, input: { workspaceId: string; userId: string; token: { accessToken: string; tokenType: string; expiresInSeconds: number | null }; grantedScopes: string[]; authorizationUserExternalId: string | null; expectedTarget: PublishingTarget }) {
  const target = await selectedPublishingTarget(client, input.workspaceId);
  if (target.connectionId !== input.expectedTarget.connectionId || target.pageExternalId !== input.expectedTarget.pageExternalId || target.instagramExternalId !== input.expectedTarget.instagramExternalId) throw new Error("The selected Page/Instagram account changed during authorization. Start publishing authorization again.");
  const missing = instagramPublishingScopes.filter((scope) => !input.grantedScopes.includes(scope));
  if (missing.length) throw new Error(`Meta did not grant required publishing permission(s): ${missing.join(", ")}.`);
  const pages = await discoverFstatsLoginFacebookPages(input.token.accessToken);
  if (!pages.some((page) => page.externalId === target.pageExternalId)) throw new Error("The publishing authorization cannot access the selected Facebook Page.");
  const linked = await discoverFstatsLoginLinkedInstagram(input.token.accessToken, target.pageExternalId);
  if (!linked || linked.externalId !== target.instagramExternalId) throw new Error("The publishing authorization is not linked to the selected Instagram professional account.");
  const { error } = await client.from("app_meta_connection_capabilities").upsert({
    workspace_id: input.workspaceId, connection_id: target.connectionId, capability: instagramPublishingCapability,
    authorization_user_external_id: input.authorizationUserExternalId,
    encrypted_token_payload: encryptMetaTokenPayload({ accessToken: input.token.accessToken }), token_type: input.token.tokenType,
    token_expires_at: input.token.expiresInSeconds ? new Date(Date.now() + input.token.expiresInSeconds * 1000).toISOString() : null,
    granted_scopes: input.grantedScopes, bound_page_external_id: target.pageExternalId, bound_instagram_external_id: target.instagramExternalId,
    state: "connected", last_error_code: null, last_error_summary: null, created_by: input.userId, updated_at: new Date().toISOString()
  }, { onConflict: "connection_id,capability" });
  if (error) throw error;
  return target;
}

export async function assertPublishingBinding(client: SupabaseClient, workspaceId: string) {
  const target = await selectedPublishingTarget(client, workspaceId);
  const { data: capability, error } = await client.from("app_meta_connection_capabilities").select("id,encrypted_token_payload,state,bound_page_external_id,bound_instagram_external_id,token_expires_at").eq("workspace_id", workspaceId).eq("connection_id", target.connectionId).eq("capability", instagramPublishingCapability).maybeSingle();
  if (error || !capability) throw error ?? new Error("Enable Instagram publishing for this selected account before scheduling.");
  if (capability.state !== "connected" || capability.bound_page_external_id !== target.pageExternalId || capability.bound_instagram_external_id !== target.instagramExternalId) throw new Error("The selected Page/Instagram account changed after publishing authorization. Reauthorize publishing; queued Reels will not be redirected.");
  if (capability.token_expires_at && new Date(capability.token_expires_at).getTime() <= Date.now()) throw new Error("Instagram publishing authorization expired. Reauthorize before publishing.");
  return { target, capabilityId: capability.id as string, accessToken: decryptMetaTokenPayload(capability.encrypted_token_payload).accessToken };
}

export async function retainStudioPublishArtifact(client: SupabaseClient, input: { workspaceId: string; renderJobId: string; userId: string }) {
  const { data: existing, error: existingError } = await client.from("studio_publish_artifacts").select("id").eq("workspace_id", input.workspaceId).eq("render_job_id", input.renderJobId).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id as string;
  const { data: asset, error } = await client.from("studio_rendered_assets").select("id,object_path,mime_type,byte_size").eq("workspace_id", input.workspaceId).eq("render_job_id", input.renderJobId).maybeSingle();
  if (error || !asset?.object_path) throw error ?? new Error("That Studio output is unavailable.");
  const id = randomUUID(); const objectPath = `workspaces/${input.workspaceId}/studio/publish/${id}/source.mp4`;
  const storage = await studioStorage(); const bucket = storage.bucket(studioRenderBucketName());
  await bucket.file(asset.object_path).copy(bucket.file(objectPath));
  const { error: insertError } = await client.from("studio_publish_artifacts").insert({ id, workspace_id: input.workspaceId, render_job_id: input.renderJobId, rendered_asset_id: asset.id, object_path: objectPath, mime_type: asset.mime_type ?? "video/mp4", byte_size: asset.byte_size, retained_until: new Date(Date.now() + 31 * 86400000).toISOString(), created_by: input.userId });
  if (insertError) { await bucket.file(objectPath).delete({ ignoreNotFound: true }); throw insertError; }
  return id;
}

export async function scheduleInstagramReels(client: SupabaseClient, input: { workspaceId: string; userId: string; items: Array<{ renderJobId: string; caption: string; scheduledFor: string; timezone: string; publishingMode: "normal" | "trial"; graduationStrategy?: "manual" | "ss_performance" }> }) {
  if (!input.items.length || input.items.length > maxInstagramReelBatch) throw new Error(`Choose between 1 and ${maxInstagramReelBatch} Studio outputs.`);
  const binding = await assertPublishingBinding(client, input.workspaceId);
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.renderJobId)) throw new Error("A Studio output can appear only once in a schedule."); seen.add(item.renderJobId);
    if (!item.caption || item.caption.length > 2200 || !Number.isFinite(new Date(item.scheduledFor).getTime())) throw new Error("Each Reel needs a valid caption and future schedule.");
    if (item.publishingMode === "trial" && !item.graduationStrategy) throw new Error("Choose a Trial Reel graduation strategy.");
  }
  const now = Date.now(); const rows = [];
  for (const item of input.items) {
    if (new Date(item.scheduledFor).getTime() <= now) throw new Error("Schedule each Reel in the future.");
    const artifactId = await retainStudioPublishArtifact(client, { workspaceId: input.workspaceId, renderJobId: item.renderJobId, userId: input.userId });
    rows.push({ workspace_id: input.workspaceId, publish_artifact_id: artifactId, base_connection_id: binding.target.connectionId, publishing_capability_id: binding.capabilityId, target_page_external_id: binding.target.pageExternalId, target_instagram_external_id: binding.target.instagramExternalId, caption_draft: item.caption, publishing_mode: item.publishingMode, trial_graduation_strategy: item.publishingMode === "trial" ? item.graduationStrategy : null, scheduled_for: item.scheduledFor, scheduled_timezone: item.timezone, status: "scheduled", execution_stage: "queued", created_by: input.userId });
  }
  const { data, error } = await client.from("instagram_reel_publications").insert(rows).select("id,scheduled_for,status");
  if (error) throw error;
  return data ?? [];
}

async function addAttempt(client: SupabaseClient, publication: any, stage: string, outcome: "started" | "succeeded" | "retryable_failure" | "terminal_failure" | "reconciled", summary?: string) {
  const { error } = await client.from("instagram_reel_publish_attempts").insert({ publication_id: publication.id, workspace_id: publication.workspace_id, attempt_number: publication.attempts, stage, outcome, summary: summary?.slice(0, 500) ?? null });
  if (error) throw error;
}

export async function reconcileInstagramReelPublication(client: SupabaseClient, input: { workspaceId: string; publicationId: string; operatorId: string }) {
  const { data: publication, error } = await client.from("instagram_reel_publications").select("*").eq("workspace_id", input.workspaceId).eq("id", input.publicationId).maybeSingle();
  if (error || !publication) throw error ?? new Error("Publication not found.");
  if (publication.status === "published") return { resolved: true, reason: "already_published" as const };
  if (publication.execution_stage !== "reconciling" && publication.status !== "publishing") throw new Error("Only an ambiguous publishing outcome can be reconciled.");
  if (!publication.meta_container_id && !publication.meta_media_id) {
    await addAttempt(client, publication, "reconciling", "reconciled", `Operator ${input.operatorId} reviewed this record. The container ID was not recorded, so automatic reconciliation is unavailable and no Meta request was made.`);
    return { resolved: false, reason: "missing_container_id" as const };
  }
  const binding = await assertPublishingBinding(client, input.workspaceId);
  if (binding.target.connectionId !== publication.base_connection_id || binding.target.pageExternalId !== publication.target_page_external_id || binding.target.instagramExternalId !== publication.target_instagram_external_id) throw new Error("Account binding changed; do not reconcile this record against a different account.");
  const mediaId = publication.meta_media_id as string | null;
  if (mediaId) {
    const response = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(mediaId)}?fields=id,permalink&access_token=${encodeURIComponent(binding.accessToken)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    const body = await response.json().catch(() => ({})) as { id?: string; permalink?: string };
    if (response.ok && body.id === mediaId) {
      const { error: updateError } = await client.from("instagram_reel_publications").update({ status: "published", execution_stage: "complete", meta_permalink: body.permalink ?? null, published_at: new Date().toISOString(), error_code: null, error_summary: null, lease_token: null, lease_expires_at: null }).eq("workspace_id", input.workspaceId).eq("id", publication.id);
      if (updateError) throw updateError;
      await addAttempt(client, publication, "reconciling", "reconciled", `Operator ${input.operatorId} confirmed the persisted Meta media ID.`);
      return { resolved: true, reason: "media_confirmed" as const };
    }
  }
  // A finished container proves processing, not that a Reel was published.
  // Never infer success or issue another publish request from this path.
  const response = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(publication.meta_container_id)}?fields=status_code,status&access_token=${encodeURIComponent(binding.accessToken)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => ({})) as { status_code?: string; status?: string };
  const summary = response.ok ? `Operator ${input.operatorId} found container status ${body.status_code ?? body.status ?? "unknown"}; it is insufficient evidence of publication.` : `Operator ${input.operatorId} could not query the persisted container (${response.status}).`;
  await addAttempt(client, publication, "reconciling", "reconciled", summary);
  return { resolved: false, reason: "insufficient_provider_evidence" as const };
}

/** Processes at most one due job. This is intentionally provider-neutral: a cron,
 * Supabase schedule, or authenticated manual route can invoke the same durable step. */
export async function dispatchOneInstagramReel(client: SupabaseClient, workspaceId: string, now = new Date()) {
  if (!instagramReelPublishingEnabled(workspaceId)) throw new Error("Instagram publishing is disabled for this workspace.");
  const lateness = instagramReelMaximumLatenessMinutes();
  // Explicit backlog policy: stale jobs fail rather than publishing unexpectedly.
  await client.from("instagram_reel_publications").update({ status: "failed", error_code: "SCHEDULE_TOO_LATE", error_summary: `Not published because it was more than ${lateness} minutes overdue.`, execution_stage: "complete", updated_at: now.toISOString() }).eq("workspace_id", workspaceId).eq("status", "scheduled").eq("execution_stage", "queued").lt("scheduled_for", new Date(now.getTime() - lateness * 60000).toISOString());
  // A crashed worker might have sent a request but never persisted Meta's
  // response. Do not lease/retry it: preserve it for explicit reconciliation.
  await client.from("instagram_reel_publications").update({ status: "failed", execution_stage: "reconciling", error_code: "LEASE_EXPIRED_AMBIGUOUS", error_summary: "A publishing worker stopped before recording its outcome. Reconcile before any further Meta request.", lease_token: null, lease_expires_at: null, updated_at: now.toISOString() }).eq("workspace_id", workspaceId).eq("status", "publishing").lt("lease_expires_at", now.toISOString());
  const { data: claimed, error } = await (client as any).rpc("claim_due_instagram_reel_publication", { p_workspace_id: workspaceId, p_now: now.toISOString(), p_max_lateness: `${lateness} minutes`, p_lease_seconds: 120 });
  if (error) throw error;
  const publication = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!publication) return { processed: false as const };
  try {
    await addAttempt(client, publication, publication.execution_stage, "started");
    const binding = await assertPublishingBinding(client, publication.workspace_id);
    if (binding.target.connectionId !== publication.base_connection_id || binding.capabilityId !== publication.publishing_capability_id || binding.target.pageExternalId !== publication.target_page_external_id || binding.target.instagramExternalId !== publication.target_instagram_external_id) throw new Error("Account binding changed; this queued Reel will not be retargeted.");
    // Do not create a second container after an ambiguous request. A later call
    // only reconciles/polls the persisted container ID.
    if (publication.meta_container_id) {
      const poll = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(publication.meta_container_id)}?fields=status_code,status&access_token=${encodeURIComponent(binding.accessToken)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const status = await poll.json().catch(() => ({})) as { status_code?: string; status?: string };
      if (!poll.ok) throw new Error(`Meta container reconciliation failed safely (${poll.status}).`);
      if ((status.status_code ?? status.status) !== "FINISHED") {
        await client.from("instagram_reel_publications").update({ status: "scheduled", next_attempt_at: new Date(Date.now() + 60_000).toISOString(), lease_token: null, lease_expires_at: null, execution_stage: "processing_container" }).eq("id", publication.id).eq("lease_token", publication.lease_token);
        await addAttempt(client, publication, "processing_container", "reconciled", "Container still processing.");
        return { processed: true as const, publicationId: publication.id, stage: "processing_container" };
      }
      await client.from("instagram_reel_publications").update({ execution_stage: "publishing" }).eq("id", publication.id).eq("lease_token", publication.lease_token);
      const publish = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(publication.target_instagram_external_id)}/media_publish`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: publication.meta_container_id, access_token: binding.accessToken }), signal: AbortSignal.timeout(45000) });
      const media = await publish.json().catch(() => ({})) as { id?: string };
      if (!publish.ok || !media.id) {
        // Preserve the container and move to reconciliation: never create/repost a replacement.
        await client.from("instagram_reel_publications").update({ status: "failed", execution_stage: "reconciling", error_code: "META_PUBLISH_AMBIGUOUS", error_summary: `Meta publish response could not be confirmed (${publish.status}).`, lease_token: null, lease_expires_at: null }).eq("id", publication.id).eq("lease_token", publication.lease_token);
        await addAttempt(client, publication, "publishing", "retryable_failure", "Publish outcome requires reconciliation.");
        return { processed: true as const, publicationId: publication.id, stage: "reconciling" };
      }
      const mediaLookup = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(media.id)}?fields=id,permalink&access_token=${encodeURIComponent(binding.accessToken)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const mediaDetails = await mediaLookup.json().catch(() => ({})) as { id?: string; permalink?: string };
      await client.from("instagram_reel_publications").update({ status: "published", execution_stage: "complete", meta_media_id: media.id, meta_permalink: mediaLookup.ok && mediaDetails.id === media.id ? mediaDetails.permalink ?? null : null, published_at: new Date().toISOString(), lease_token: null, lease_expires_at: null, error_code: null, error_summary: null }).eq("id", publication.id).eq("lease_token", publication.lease_token);
      await addAttempt(client, publication, "publishing", "succeeded");
      return { processed: true as const, publicationId: publication.id, stage: "published" };
    }
    if (!publication.meta_container_id) {
      const { data: artifact, error: artifactError } = await client.from("studio_publish_artifacts").select("object_path").eq("id", publication.publish_artifact_id).eq("workspace_id", publication.workspace_id).single();
      if (artifactError || !artifact) throw artifactError ?? new Error("Retained publish media is unavailable.");
      // Persist intent before the provider call. A process crash after Meta
      // accepts the request is therefore treated as ambiguous, never retried.
      await client.from("instagram_reel_publications").update({ execution_stage: "creating_container" }).eq("id", publication.id).eq("lease_token", publication.lease_token);
      publication.execution_stage = "creating_container";
      const [url] = await (await studioStorage()).bucket(studioRenderBucketName()).file(artifact.object_path).getSignedUrl({ action: "read", expires: Date.now() + 24 * 60 * 60 * 1000, version: "v4" });
      const form = new URLSearchParams({ media_type: "REELS", video_url: url, caption: publication.caption_draft });
      if (publication.publishing_mode === "trial") form.set("trial_params", JSON.stringify({ graduation_strategy: publication.trial_graduation_strategy === "ss_performance" ? "SS_PERFORMANCE" : "MANUAL" }));
      const response = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(publication.target_instagram_external_id)}/media`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...Object.fromEntries(form), access_token: binding.accessToken }), signal: AbortSignal.timeout(45000) });
      const payload = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok || !payload.id) throw new Error(`Meta container creation failed safely (${response.status}).`);
      publication.meta_container_id = payload.id;
      await client.from("instagram_reel_publications").update({ meta_container_id: payload.id, caption_used: publication.caption_draft, signed_source_expires_at: new Date(Date.now() + 86400000).toISOString(), execution_stage: "processing_container" }).eq("id", publication.id).eq("lease_token", publication.lease_token);
      await addAttempt(client, publication, "creating_container", "succeeded");
    }
    // Container polling/publish is deliberately a later durable invocation.
    await client.from("instagram_reel_publications").update({ status: "scheduled", next_attempt_at: new Date(Date.now() + 60_000).toISOString(), lease_token: null, lease_expires_at: null, execution_stage: "processing_container" }).eq("id", publication.id).eq("lease_token", publication.lease_token);
    return { processed: true as const, publicationId: publication.id, stage: "processing_container" };
  } catch (cause) {
    const summary = cause instanceof Error ? cause.message : "Unknown publishing error.";
    await addAttempt(client, publication, publication.execution_stage, "retryable_failure", summary);
    await client.from("instagram_reel_publications").update({ status: "failed", execution_stage: "reconciling", error_code: "PUBLISHING_DISPATCH_FAILED", error_summary: summary.slice(0, 500), lease_token: null, lease_expires_at: null }).eq("id", publication.id).eq("lease_token", publication.lease_token);
    return { processed: true as const, publicationId: publication.id, stage: "failed" };
  }
}

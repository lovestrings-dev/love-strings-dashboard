import { NextResponse, type NextRequest } from "next/server";
import {
  requireWorkspaceAccess,
  requireWorkspaceAdministrator,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

type TemplateStepPayload = {
  id: string;
  stableKey: string;
  displayName: string;
  position: number;
  stepKind: "idea_anchor" | "production_step" | "release_anchor";
  semanticKind: "standard" | "distribution";
  isEnabled: boolean;
  leadTimeDays: number;
  standardCostAmount: number | null;
};

function response(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { serviceClient, workspaceId } = await requireWorkspaceAccess(request);
    const { data, error } = await serviceClient
      .from("production_templates")
      .select("id, name, template_version, production_template_steps (id, stable_key, display_name, position, step_kind, semantic_kind, is_enabled, lead_time_days, standard_cost_amount)")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();
    if (error) throw error;
    return response({ template: mapTemplate(data) });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Production template unavailable." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSameOriginWrite(request)) return response({ error: "Unauthorized request." }, { status: 401 });
    const { serviceClient, workspaceId } = await requireWorkspaceAdministrator(request);
    const payload = await request.json() as { steps?: TemplateStepPayload[] };
    const steps = validateSteps(payload.steps);
    const { data: template, error: templateError } = await serviceClient
      .from("production_templates")
      .select("id, name, template_version")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();
    if (templateError) throw templateError;

    const { data: currentSteps, error: currentError } = await serviceClient
      .from("production_template_steps")
      .select("id")
      .eq("production_template_id", template.id);
    if (currentError) throw currentError;
    const currentIds = new Set((currentSteps ?? []).map((step) => step.id));
    const incomingIds = new Set(steps.map((step) => step.id));
    const removedIds = (currentSteps ?? []).map((step) => step.id).filter((id) => !incomingIds.has(id));
    if (removedIds.length > 0) {
      const { error } = await serviceClient
        .from("production_template_steps")
        .delete()
        .in("id", removedIds)
        .eq("production_template_id", template.id);
      if (error) throw error;
    }

    // Positions are unique per template. Stage existing rows outside the valid
    // editor range before applying a reordered workflow so a swap never
    // transiently conflicts with its neighbour.
    const temporaryPositionBase = 1_000_000_000;
    for (const [index, step] of steps.entries()) {
      if (!currentIds.has(step.id)) continue;
      const { error } = await serviceClient
        .from("production_template_steps")
        .update({ position: temporaryPositionBase + index })
        .eq("id", step.id)
        .eq("production_template_id", template.id);
      if (error) throw error;
    }

    for (const step of steps) {
      const values = {
        display_name: step.displayName,
        is_enabled: step.isEnabled,
        lead_time_days: step.leadTimeDays,
        position: step.position,
        semantic_kind: step.semanticKind,
        stable_key: step.stableKey,
        standard_cost_amount: step.standardCostAmount ?? 0,
        step_kind: step.stepKind
      };
      if (currentIds.has(step.id)) {
        const { error } = await serviceClient.from("production_template_steps").update(values).eq("id", step.id).eq("production_template_id", template.id);
        if (error) throw error;
      } else {
        const { error } = await serviceClient.from("production_template_steps").insert({ ...values, id: step.id, production_template_id: template.id });
        if (error) throw error;
      }
    }

    return response({ template: { id: template.id, name: template.name, templateVersion: template.template_version, steps } });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Production template update failed." }, { status: error instanceof WorkspaceAccessError ? error.status : 500 });
  }
}

function validateSteps(value: unknown): TemplateStepPayload[] {
  if (!Array.isArray(value)) throw new Error("Production template steps are required.");
  const steps = value as TemplateStepPayload[];
  const idea = steps.filter((step) => step.stepKind === "idea_anchor");
  const release = steps.filter((step) => step.stepKind === "release_anchor");
  const distribution = steps.filter((step) => step.semanticKind === "distribution");
  if (idea.length !== 1 || release.length !== 1 || distribution.length !== 1) throw new Error("Production template requires one Idea, one Distributor, and one Release row.");
  if (!idea[0].isEnabled || !release[0].isEnabled || idea[0].position !== 0 || release[0].displayName !== "Release" || idea[0].displayName !== "Idea") throw new Error("Idea and Release rows are fixed.");
  const ordered = [...steps].sort((first, second) => first.position - second.position);
  if (ordered[0].id !== idea[0].id || ordered.at(-1)?.id !== release[0].id || ordered.at(-2)?.id !== distribution[0].id || distribution[0].displayName !== "Distributor") throw new Error("Distributor must remain directly before Release.");
  const ids = new Set<string>();
  const positions = new Set<number>();
  for (const step of steps) {
    if (!/^[0-9a-f-]{36}$/i.test(step.id) || ids.has(step.id)) throw new Error("Production template step identity is invalid.");
    ids.add(step.id);
    if (!Number.isInteger(step.position) || step.position < 0 || step.position >= 1_000_000_000 || positions.has(step.position)) throw new Error("Production template positions are invalid.");
    positions.add(step.position);
    if (!step.stableKey.trim() || step.leadTimeDays < 0 || !Number.isInteger(step.leadTimeDays) || (step.standardCostAmount !== null && (!Number.isFinite(step.standardCostAmount) || step.standardCostAmount > 0))) throw new Error("Production template timing or cost is invalid.");
  }
  return ordered;
}

function mapTemplate(template: { id: string; name: string; template_version: number; production_template_steps: Array<Record<string, unknown>> | null }) {
  return {
    id: template.id,
    name: template.name,
    templateVersion: template.template_version,
    steps: (template.production_template_steps ?? []).map((step) => ({
      displayName: String(step.display_name), id: String(step.id), isEnabled: Boolean(step.is_enabled), leadTimeDays: Number(step.lead_time_days), position: Number(step.position), semanticKind: step.semantic_kind, stableKey: String(step.stable_key), standardCostAmount: Number(step.standard_cost_amount), stepKind: step.step_kind
    })).sort((first, second) => first.position - second.position)
  };
}

function isSameOriginWrite(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

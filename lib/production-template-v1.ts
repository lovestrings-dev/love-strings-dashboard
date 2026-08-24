export type ProductionSchedulingModel = "legacy-v0" | "template-v1";
export type ProductionStepStatus = "not-started" | "in-progress" | "done";
export type ProductionTemplateStepKind =
  | "idea_anchor"
  | "production_step"
  | "release_anchor";
export type ProductionTemplateSemanticKind = "standard" | "distribution";

export type ProductionTemplateV1 = {
  id: string;
  name: string;
  templateVersion: number;
  steps: ProductionTemplateStepV1[];
};

export type ProductionTemplateStepV1 = {
  id: string;
  stableKey: string;
  displayName: string;
  position: number;
  stepKind: ProductionTemplateStepKind;
  semanticKind: ProductionTemplateSemanticKind;
  isEnabled: boolean;
  leadTimeDays: number;
  standardCostAmount: number;
};

export type ProductionV1SnapshotStep = Omit<ProductionTemplateStepV1, "isEnabled"> & {
  /** A song-local custom step without workspace-template identity. */
  timingMode?: "derived" | "fixed";
};

export type ProductionV1SongSnapshot = {
  schedulingModel: "template-v1";
  templateId: string;
  templateVersion: number;
  releaseAnchor: ProductionV1SnapshotStep;
  steps: ProductionV1SnapshotStep[];
};

export type ProductionV1LiveStep = ProductionV1SnapshotStep & {
  deadline: string;
  status: ProductionStepStatus;
};

export type ProductionV1SongPlan = {
  schedulingModel: "template-v1";
  releaseDate: string;
  productionDeadline: string;
  snapshot: ProductionV1SongSnapshot;
  steps: ProductionV1LiveStep[];
};

export type ProductionV1LiveStepState = Pick<
  ProductionV1LiveStep,
  "deadline" | "id" | "status"
>;

export type ProductionV1TemplateDriftReason =
  | "template-id"
  | "template-version"
  | "workflow-steps"
  | "release-anchor";

export type ProductionV1TemplateDrift = {
  isDrifted: boolean;
  reasons: ProductionV1TemplateDriftReason[];
};

export type LegacyProductionSongPlan = {
  schedulingModel: "legacy-v0";
  releaseDate: string;
  productionDeadline: string;
  steps: Array<{ deadline: string; label: string; status: ProductionStepStatus }>;
};

export type ProductionScheduleWarning = {
  code: "locked-step-deviates-from-standard";
  stepId: string;
  actualDeadline: string;
  plannedDeadline: string;
};

export type ProductionScheduleConflict = {
  code: "workflow-order-inversion";
  earlierStepId: string;
  laterStepId: string | "release";
  earlierDeadline: string;
  laterDeadline: string;
};

export type ProductionV1RecalculationResult = {
  schedulingModel: "template-v1";
  releaseDate: string;
  productionDeadline: string;
  steps: ProductionV1LiveStep[];
  plannedDeadlines: Record<string, string>;
  warnings: ProductionScheduleWarning[];
  conflicts: ProductionScheduleConflict[];
};

export type LegacyProductionRecalculationResult = {
  schedulingModel: "legacy-v0";
  releaseDate: string;
  productionDeadline: string;
  steps: LegacyProductionSongPlan["steps"];
  warnings: [];
  conflicts: [];
};

const millisecondsPerDay = 86_400_000;

function parseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Expected an ISO calendar date, received ${date}.`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Expected a valid ISO calendar date, received ${date}.`);
  }

  return parsed;
}

function addUtcDays(date: string, days: number) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function compareDates(first: string, second: string) {
  return parseDate(first).getTime() - parseDate(second).getTime();
}

function cloneStep(step: ProductionTemplateStepV1): ProductionV1SnapshotStep {
  return {
    displayName: step.displayName,
    id: step.id,
    leadTimeDays: step.leadTimeDays,
    position: step.position,
    semanticKind: step.semanticKind,
    standardCostAmount: step.standardCostAmount,
    stableKey: step.stableKey,
    stepKind: step.stepKind
  };
}

export function sortProductionV1StepsByPosition<T extends { position: number }>(steps: T[]) {
  return [...steps].sort((first, second) => first.position - second.position);
}

export function createProductionV1SongSnapshot(template: ProductionTemplateV1): ProductionV1SongSnapshot {
  if (!Number.isInteger(template.templateVersion) || template.templateVersion <= 0) {
    throw new Error("Production Template V1 requires a positive template version.");
  }

  const ordered = sortProductionV1StepsByPosition(template.steps);
  const ideaAnchors = ordered.filter((step) => step.stepKind === "idea_anchor");
  const releaseAnchors = ordered.filter((step) => step.stepKind === "release_anchor");
  if (ideaAnchors.length !== 1 || releaseAnchors.length !== 1) {
    throw new Error("Production Template V1 requires exactly one Idea and one Release anchor.");
  }

  const snapshotSteps = ordered
    .filter(
      (step) =>
        step.stepKind === "idea_anchor" ||
        (step.stepKind === "production_step" && step.isEnabled)
    )
    .map(cloneStep);

  return {
    releaseAnchor: cloneStep(releaseAnchors[0]),
    schedulingModel: "template-v1",
    steps: snapshotSteps,
    templateId: template.id,
    templateVersion: template.templateVersion
  };
}

function snapshotStepSignature(step: ProductionV1SnapshotStep) {
  return JSON.stringify({
    displayName: step.displayName,
    id: step.id,
    leadTimeDays: step.leadTimeDays,
    position: step.position,
    semanticKind: step.semanticKind,
    stableKey: step.stableKey,
    standardCostAmount: step.standardCostAmount,
    stepKind: step.stepKind
  });
}

/**
 * Compares scheduling structure, not labels alone. A workspace template may be
 * edited in place without receiving a new version, so template ID/version are
 * useful evidence but cannot be the only drift signal.
 */
export function getProductionV1TemplateDrift(
  snapshot: ProductionV1SongSnapshot,
  currentTemplate: ProductionTemplateV1
): ProductionV1TemplateDrift {
  const currentSnapshot = createProductionV1SongSnapshot(currentTemplate);
  const reasons: ProductionV1TemplateDriftReason[] = [];

  if (snapshot.templateId !== currentSnapshot.templateId) reasons.push("template-id");
  if (snapshot.templateVersion !== currentSnapshot.templateVersion) reasons.push("template-version");
  if (
    snapshot.steps.map(snapshotStepSignature).join("|") !==
    currentSnapshot.steps.map(snapshotStepSignature).join("|")
  ) {
    reasons.push("workflow-steps");
  }
  if (snapshotStepSignature(snapshot.releaseAnchor) !== snapshotStepSignature(currentSnapshot.releaseAnchor)) {
    reasons.push("release-anchor");
  }

  return { isDrifted: reasons.length > 0, reasons };
}

/**
 * Rehydrates live status/deadline state onto immutable song snapshot metadata.
 * Release-date changes must pass this plan to the scheduler; current workspace
 * template data belongs only to future-song creation or an explicit replan.
 */
export function createProductionV1SongPlanFromSnapshot({
  liveSteps,
  productionDeadline,
  releaseDate,
  snapshot
}: {
  liveSteps: ProductionV1LiveStepState[];
  productionDeadline: string;
  releaseDate: string;
  snapshot: ProductionV1SongSnapshot;
}): ProductionV1SongPlan {
  const liveStepById = new Map(liveSteps.map((step) => [step.id, step]));
  const snapshotStepIds = new Set(snapshot.steps.map((step) => step.id));
  const unexpectedLiveStep = liveSteps.find((step) => !snapshotStepIds.has(step.id));

  if (unexpectedLiveStep) {
    throw new Error(`Live V1 Production step ${unexpectedLiveStep.id} is absent from its template snapshot.`);
  }

  const orderedSnapshotSteps = sortProductionV1StepsByPosition(snapshot.steps);

  return {
    productionDeadline,
    releaseDate,
    schedulingModel: "template-v1",
    snapshot,
    steps: orderedSnapshotSteps.map((snapshotStep) => {
      const liveStep = liveStepById.get(snapshotStep.id);
      if (!liveStep) {
        throw new Error(`V1 template snapshot step ${snapshotStep.id} is absent from the live song.`);
      }

      return { ...snapshotStep, deadline: liveStep.deadline, status: liveStep.status };
    })
  };
}

function calculatePlannedDeadlines(snapshot: ProductionV1SongSnapshot, releaseDate: string) {
  parseDate(releaseDate);
  const orderedSteps = sortProductionV1StepsByPosition(snapshot.steps).filter(
    (step) => step.timingMode !== "fixed"
  );
  const plannedDeadlines: Record<string, string> = {};
  const distributionIndex = orderedSteps.findIndex(
    (step) => step.stepKind === "production_step" && step.semanticKind === "distribution"
  );
  const distributionStep = distributionIndex >= 0 ? orderedSteps[distributionIndex] : undefined;

  // Distribution is a semantic Release boundary, not a label or a positional
  // convention. It therefore receives its own declared Release lead even if a
  // future template places another workflow step after it.
  if (distributionStep) {
    plannedDeadlines[distributionStep.id] = addUtcDays(
      releaseDate,
      -distributionStep.leadTimeDays
    );

    let nextBoundaryDate = releaseDate;
    for (let index = orderedSteps.length - 1; index > distributionIndex; index -= 1) {
      const step = orderedSteps[index];
      const deadline = addUtcDays(nextBoundaryDate, -step.leadTimeDays);
      plannedDeadlines[step.id] = deadline;
      nextBoundaryDate = deadline;
    }

    nextBoundaryDate = plannedDeadlines[distributionStep.id];
    for (let index = distributionIndex - 1; index >= 0; index -= 1) {
      const step = orderedSteps[index];
      const deadline = addUtcDays(nextBoundaryDate, -step.leadTimeDays);
      plannedDeadlines[step.id] = deadline;
      nextBoundaryDate = deadline;
    }
  } else {
    let nextBoundaryDate = releaseDate;
    for (const step of [...orderedSteps].reverse()) {
      const deadline = addUtcDays(nextBoundaryDate, -step.leadTimeDays);
      plannedDeadlines[step.id] = deadline;
      nextBoundaryDate = deadline;
    }
  }

  return {
    plannedDeadlines,
    productionDeadline: distributionStep
      ? plannedDeadlines[distributionStep.id]
      : releaseDate
  };
}

export function instantiateProductionV1Song(
  template: ProductionTemplateV1,
  releaseDate: string
): ProductionV1SongPlan {
  const snapshot = createProductionV1SongSnapshot(template);
  const schedule = calculatePlannedDeadlines(snapshot, releaseDate);

  return {
    productionDeadline: schedule.productionDeadline,
    releaseDate,
    schedulingModel: "template-v1",
    snapshot,
    steps: sortProductionV1StepsByPosition(snapshot.steps).map((step) => ({
      ...step,
      deadline: schedule.plannedDeadlines[step.id],
      status: "not-started"
    }))
  };
}

function detectScheduleConflicts(
  steps: ProductionV1LiveStep[],
  releaseDate: string
): ProductionScheduleConflict[] {
  const ordered = sortProductionV1StepsByPosition(steps);
  const boundaries = [
    ...ordered.map((step) => ({ deadline: step.deadline, id: step.id })),
    { deadline: releaseDate, id: "release" as const }
  ];
  const conflicts: ProductionScheduleConflict[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const earlier = boundaries[index];
    const later = boundaries[index + 1];
    if (compareDates(earlier.deadline, later.deadline) > 0) {
      conflicts.push({
        code: "workflow-order-inversion",
        earlierDeadline: earlier.deadline,
        earlierStepId: earlier.id,
        laterDeadline: later.deadline,
        laterStepId: later.id
      });
    }
  }

  return conflicts;
}

export function recalculateProductionV1Song(
  song: ProductionV1SongPlan,
  releaseDate: string
): ProductionV1RecalculationResult {
  parseDate(releaseDate);
  const schedule = calculatePlannedDeadlines(song.snapshot, releaseDate);
  const warnings: ProductionScheduleWarning[] = [];
  const steps = sortProductionV1StepsByPosition(song.steps).map((step) => {
    if (step.timingMode === "fixed") {
      return { ...step };
    }

    const plannedDeadline = schedule.plannedDeadlines[step.id];
    if (!plannedDeadline) {
      throw new Error(`Live V1 Production step ${step.id} is absent from its template snapshot.`);
    }

    if (step.status !== "not-started") {
      if (step.deadline !== plannedDeadline) {
        warnings.push({
          actualDeadline: step.deadline,
          code: "locked-step-deviates-from-standard",
          plannedDeadline,
          stepId: step.id
        });
      }
      return { ...step };
    }

    return { ...step, deadline: plannedDeadline };
  });

  return {
    conflicts: detectScheduleConflicts(steps, releaseDate),
    plannedDeadlines: schedule.plannedDeadlines,
    productionDeadline: schedule.productionDeadline,
    releaseDate,
    schedulingModel: "template-v1",
    steps,
    warnings
  };
}

// Callers that handle both models can use this without accidentally applying
// legacy label-driven V0 scheduling to a V1 snapshot.
export function recalculateProductionSong(
  song: ProductionV1SongPlan | LegacyProductionSongPlan,
  releaseDate: string
): ProductionV1RecalculationResult | LegacyProductionRecalculationResult {
  if (song.schedulingModel === "legacy-v0") {
    return {
      conflicts: [],
      productionDeadline: song.productionDeadline,
      releaseDate: song.releaseDate,
      schedulingModel: "legacy-v0",
      steps: song.steps.map((step) => ({ ...step })),
      warnings: []
    };
  }

  return recalculateProductionV1Song(song, releaseDate);
}

export function daysBetweenProductionDates(earlierDate: string, laterDate: string) {
  return Math.round((parseDate(laterDate).getTime() - parseDate(earlierDate).getTime()) / millisecondsPerDay);
}

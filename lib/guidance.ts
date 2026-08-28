export const gettingStartedV1Program = "getting_started_v1" as const;

export const gettingStartedV1Steps = [
  "artistdeck_basics",
  "first_song",
  "google_youtube",
  "invite_member"
] as const;

export type GettingStartedV1Step = (typeof gettingStartedV1Steps)[number];

export function isGettingStartedV1ActorEligible(input: {
  isPlatformOwner: boolean;
  workspaceRole: "admin" | "member" | "viewer";
}) {
  return input.workspaceRole === "admin" && !input.isPlatformOwner;
}

export type GuidanceStatus =
  | { active: false }
  | {
      active: true;
      program: typeof gettingStartedV1Program;
      completed: number;
      total: number;
      nextStep: GettingStartedV1Step | null;
      steps: Record<GettingStartedV1Step, boolean>;
      skipped?: Record<GettingStartedV1Step, boolean>;
    };

export type GuidanceEvaluation = {
  eligible: boolean;
  completedProgram: boolean;
  steps: Record<GettingStartedV1Step, boolean>;
  skipped?: Record<GettingStartedV1Step, boolean>;
};

// This pure mapping mirrors the database RPC contract and keeps presentation
// consumers independent from persistence details.
export function guidanceStatusFromEvaluation(input: GuidanceEvaluation): GuidanceStatus {
  if (!input.eligible || input.completedProgram) return { active: false };

  const skipped = input.skipped ?? {
    artistdeck_basics: false,
    first_song: false,
    google_youtube: false,
    invite_member: false
  };
  const completed = gettingStartedV1Steps.filter((step) => input.steps[step]).length;
  if (completed === gettingStartedV1Steps.length) {
    return {
      active: true,
      program: gettingStartedV1Program,
      completed,
      total: gettingStartedV1Steps.length,
      nextStep: null,
      skipped,
      steps: input.steps
    };
  }
  const nextStep = gettingStartedV1Steps.find(
    (step) => !input.steps[step] && !skipped[step]
  );
  if (!nextStep) return { active: false };

  return {
    active: true,
    program: gettingStartedV1Program,
    completed,
    total: gettingStartedV1Steps.length,
    nextStep,
    skipped,
    steps: input.steps
  };
}

export function guidanceStatusAfterSkip(
  status: GuidanceStatus,
  step: Exclude<GettingStartedV1Step, "artistdeck_basics">
): GuidanceStatus {
  if (!status.active) return status;
  return guidanceStatusFromEvaluation({
    completedProgram: false,
    eligible: true,
    skipped: {
      artistdeck_basics: false,
      first_song: false,
      google_youtube: false,
      invite_member: false,
      ...status.skipped,
      [step]: true
    },
    steps: status.steps
  });
}

/** Dates are normalized ISO calendar dates; today remains an active release. */
export function completeStepsForPastRelease<T extends {
  status: string;
  extraTasks: Array<{ status: string }>;
}>(steps: T[], releaseDate: string | null, today: string): T[] {
  if (!releaseDate || releaseDate >= today) return steps;
  return steps.map((step) => ({
    ...step,
    status: "done",
    extraTasks: step.extraTasks.map((task) => ({ ...task, status: "done" }))
  }));
}

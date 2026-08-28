import {
  refreshMetricCollectors,
  type MetricCollectorName
} from "@/lib/metrics/collectors";

/**
 * Connection persistence is authoritative. A failed first collection must not
 * undo it, but waiting here ensures a successful collection is visible before
 * the callback returns to the app.
 */
export async function collectAfterConnection(
  workspaceId: string,
  collectors: readonly MetricCollectorName[]
) {
  try {
    const results = await refreshMetricCollectors(workspaceId, collectors);
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.warn("Initial platform collection did not complete.", {
        collectors: failed.map((result) => result.name),
        workspaceId
      });
    }
    return results;
  } catch (error) {
    console.warn("Initial platform collection could not start.", {
      collectors,
      message: error instanceof Error ? error.message : String(error),
      workspaceId
    });
    return [];
  }
}

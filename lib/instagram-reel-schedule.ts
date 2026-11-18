export type LocalSchedule = { date: string; time: string; timezone: string; offsetDays: number };

export function shouldExpireUnstartedPublication(status: string, stage: string, scheduledFor: string | null, now: Date, latenessMinutes: number) {
  return status === "scheduled" && stage === "queued" && !!scheduledFor && new Date(scheduledFor).getTime() < now.getTime() - latenessMinutes * 60000;
}

// Converts a calendar date/time in the explicitly selected IANA zone. It
// rejects nonexistent spring-forward times and deterministically chooses the
// earlier occurrence during a fall-back overlap.
export function zonedScheduleToUtc(input: LocalSchedule): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time) || !Number.isInteger(input.offsetDays) || input.offsetDays < 0) throw new Error("Invalid schedule date or time.");
  const local = new Date(`${input.date}T${input.time}:00Z`);
  if (!Number.isFinite(local.getTime())) throw new Error("Invalid schedule date or time.");
  local.setUTCDate(local.getUTCDate() + input.offsetDays);
  const wanted = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")} ${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-CA", { timeZone: input.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); } catch { throw new Error("Choose a valid IANA timezone."); }
  const center = local.getTime();
  for (let time = center - 15 * 3600000; time <= center + 15 * 3600000; time += 60000) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(time)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    if (`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` === wanted) return new Date(time).toISOString();
  }
  throw new Error("This local time does not exist in the selected timezone (daylight-saving transition).");
}

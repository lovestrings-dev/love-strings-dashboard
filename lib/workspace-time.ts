export const defaultWorkspaceTimeZone = "Europe/Vienna";

export function getWorkspaceDateKey(timeZone = defaultWorkspaceTimeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function resolveTimeZone(value?: string | null) {
  const candidate = value?.trim() || defaultWorkspaceTimeZone;

  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate })
      .resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

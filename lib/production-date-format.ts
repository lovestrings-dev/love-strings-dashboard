/**
 * Production persistence is ISO-first. The API still accepts the DateInput
 * display value at its boundary, but never reparses a server-derived ISO date.
 */
export function normalizeProductionDateForPersistence(value: string) {
  const trimmed = value.trim();
  if (isIsoCalendarDate(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) return null;
  return parsed.toISOString().slice(0, 10);
}

function isIsoCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

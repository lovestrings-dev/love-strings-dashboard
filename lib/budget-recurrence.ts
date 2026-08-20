export type BudgetRecurringCadence =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export function addBudgetRecurrenceCadence(
  date: Date,
  cadence: BudgetRecurringCadence | undefined
) {
  if (cadence === "daily") {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
    );
  }

  if (cadence === "weekly") {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 7)
    );
  }

  return addMonthsToDate(date, cadence === "yearly" ? 12 : 1);
}

function addMonthsToDate(date: Date, months: number) {
  const nextDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
  const targetDay = date.getUTCDate();
  const lastDayOfMonth = new Date(
    Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)
  ).getUTCDate();

  nextDate.setUTCDate(Math.min(targetDay, lastDayOfMonth));
  return nextDate;
}

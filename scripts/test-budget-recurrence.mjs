import assert from "node:assert/strict";

const { addBudgetRecurrenceCadence } = await import("../lib/budget-recurrence.ts");

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

const start = new Date(Date.UTC(2026, 0, 31));

assert.equal(dateKey(addBudgetRecurrenceCadence(start, "daily")), "2026-02-01");
assert.equal(dateKey(addBudgetRecurrenceCadence(start, "weekly")), "2026-02-07");
assert.equal(dateKey(addBudgetRecurrenceCadence(start, "monthly")), "2026-02-28");
assert.equal(dateKey(addBudgetRecurrenceCadence(start, "yearly")), "2027-01-31");
assert.equal(
  dateKey(addBudgetRecurrenceCadence(new Date(Date.UTC(2024, 1, 29)), "yearly")),
  "2025-02-28"
);

console.log("Budget recurrence cadence checks passed.");

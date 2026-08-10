import assert from "node:assert/strict";

const {
  formatDateInput,
  getDateInputCaretPosition,
  isPartialDateInput,
  parseDdMmYyyy,
  toDisplayDate,
  toIsoDate
} = await import("../lib/date-input.ts");

assert.deepEqual(parseDdMmYyyy("10/08/2026"), { day: 10, month: 8, year: 2026 });
assert.deepEqual(parseDdMmYyyy("29/02/2028"), { day: 29, month: 2, year: 2028 });
assert.equal(parseDdMmYyyy("29/02/2027"), null);
assert.equal(parseDdMmYyyy("31/04/2026"), null);
assert.equal(parseDdMmYyyy(""), null);
assert.equal(isPartialDateInput("10/08/"), true);
assert.equal(formatDateInput("22"), "22/");
assert.equal(getDateInputCaretPosition("22/", 2), 3);
assert.equal(formatDateInput("2208"), "22/08/");
assert.equal(getDateInputCaretPosition("22/08/", 4), 6);
assert.equal(formatDateInput("10082026"), "10/08/2026");
assert.equal(formatDateInput("10/08/2026"), "10/08/2026");
assert.equal(toIsoDate("10/08/2026"), "2026-08-10");
assert.equal(toDisplayDate("2026-08-10"), "10/08/2026");
assert.equal(toDisplayDate("2027-02-29"), "");

console.log("Date input checks passed.");

export type DateParts = {
  day: number;
  month: number;
  year: number;
};

const displayDatePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getDaysInMonth(year: number, month: number) {
  if (month < 1 || month > 12) return 0;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidDateParts({ day, month, year }: DateParts) {
  return (
    Number.isInteger(day) &&
    Number.isInteger(month) &&
    Number.isInteger(year) &&
    year >= 1 &&
    day >= 1 &&
    day <= getDaysInMonth(year, month)
  );
}

export function parseDdMmYyyy(value: string): DateParts | null {
  const match = value.match(displayDatePattern);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = { day: Number(day), month: Number(month), year: Number(year) };
  return isValidDateParts(date) ? date : null;
}

export function parseIsoDate(value: string): DateParts | null {
  const match = value.match(isoDatePattern);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = { day: Number(day), month: Number(month), year: Number(year) };
  return isValidDateParts(date) ? date : null;
}

export function toIsoDate(value: string) {
  const date = parseDdMmYyyy(value);
  if (!date) return null;

  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function toDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return "";

  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${String(date.year).padStart(4, "0")}`;
}

export function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length < 2) return digits;
  if (digits.length === 2) return `${digits}/`;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}${digits.length === 4 ? "/" : ""}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function getDateInputCaretPosition(value: string, digitCount: number) {
  if (digitCount <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seenDigits += 1;
    if (seenDigits === digitCount) {
      return value[index + 1] === "/" ? index + 2 : index + 1;
    }
  }

  return value.length;
}

export function isPartialDateInput(value: string) {
  const formattedValue = formatDateInput(value);
  return formattedValue === value && value.length < 10;
}

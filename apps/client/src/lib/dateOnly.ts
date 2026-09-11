/** A calendar date is a civil day, not an instant in a time zone. */
export type DateOnlyInput = Date | string | null | undefined;

export type DateInputParseResult =
  | { kind: "valid"; value: string }
  | { kind: "empty" | "incomplete" | "invalid" | "format" };

export interface DateInputFormat {
  locale: string;
  hint: string;
  format: (value: string) => string;
  parse: (input: string) => DateInputParseResult;
}

export interface DateOnlyValidationOptions {
  min?: string;
  max?: string;
  required?: boolean;
}

type DatePart = "year" | "month" | "day";
type FormatPart = { type: DatePart | "literal"; value: string };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
const BIDI_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function fromParts(year: number, month: number, day: number): string | null {
  if (!isCalendarDate(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Preserve legacy ISO strings' recorded date; never shift them through UTC. */
export function normalizeDateOnly(value: DateOnlyInput): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return fromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value !== "string") return null;
  const input = value.trim();
  const date = DATE_ONLY.test(input) ? input : ISO_TIMESTAMP.exec(input)?.[1];
  const parts = date?.match(DATE_ONLY);
  return parts ? fromParts(Number(parts[1]), Number(parts[2]), Number(parts[3])) : null;
}

/** Local noon avoids midnight DST transitions; setFullYear handles years 1–99. */
export function toLocalDate(value: DateOnlyInput): Date | undefined {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  // A few historical time-zone changes skipped an entire civil day.
  return normalizeDateOnly(date) === normalized ? date : undefined;
}

export function todayDateOnly(now: Date = new Date()): string {
  const value = normalizeDateOnly(now);
  if (!value) throw new RangeError("A valid current date is required.");
  return value;
}

export function validateDateOnly(
  value: DateOnlyInput,
  { min, max, required = false }: DateOnlyValidationOptions = {},
): "invalid" | "min" | "max" | "required" | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return required ? "required" : null;
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "invalid";
  const minimum = normalizeDateOnly(min);
  const maximum = normalizeDateOnly(max);
  if (minimum && normalized < minimum) return "min";
  if (maximum && normalized > maximum) return "max";
  return null;
}

function compact(value: string): string {
  return value.replace(BIDI_MARKS, "").replace(/\s/g, "");
}

/** Numeric Gregorian entry in the user's locale, with YYYY-MM-DD as an escape hatch. */
export function getDateInputFormat(locale?: string): DateInputFormat {
  const options: Intl.DateTimeFormatOptions = { calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit" };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, options);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", options);
  }
  const resolvedLocale = formatter.resolvedOptions().locale;
  const parts = formatter.formatToParts(new Date(2006, 10, 22, 12)).map<FormatPart>((part) => ({
    type: part.type === "year" || part.type === "month" || part.type === "day" ? part.type : "literal",
    value: part.value.replace(BIDI_MARKS, ""),
  }));
  const tokens: Record<DatePart, string> = { year: "YYYY", month: "MM", day: "DD" };
  const numberFormatter = new Intl.NumberFormat(resolvedLocale, { useGrouping: false });
  const digits = Array.from({ length: 10 }, (_, digit) => numberFormatter.format(digit).replace(BIDI_MARKS, ""));
  const normalizeDigits = (value: string) => digits.reduce((text, digit, index) => text.split(digit).join(String(index)), value);

  return {
    locale: resolvedLocale,
    hint: parts.map((part) => part.type === "literal" ? part.value : tokens[part.type]).join(""),
    format(value) {
      const normalized = normalizeDateOnly(value);
      if (!normalized) return "";
      const [year, month, day] = normalized.split("-");
      const values: Record<DatePart, string> = { year, month, day };
      return parts.map((part) => part.type === "literal"
        ? part.value
        : values[part.type].replace(/\d/g, (digit) => digits[Number(digit)])).join("");
    },
    parse(input) {
      let remaining = compact(normalizeDigits(input));
      if (!remaining) return { kind: "empty" };
      if (DATE_ONLY.test(remaining)) {
        const value = normalizeDateOnly(remaining);
        return value ? { kind: "valid", value } : { kind: "invalid" };
      }
      if (/^\d{4}(?:-\d{0,2}(?:-\d{0,2})?)?$/.test(remaining)) return { kind: "incomplete" };

      const values: Partial<Record<DatePart, number>> = {};
      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (part.type === "literal") {
          const literal = compact(part.value);
          // The trailing punctuation in some locales is optional while typing.
          if (!remaining && index === parts.length - 1) continue;
          if (!remaining.startsWith(literal)) {
            return { kind: literal.startsWith(remaining) ? "incomplete" : "format" };
          }
          remaining = remaining.slice(literal.length);
          continue;
        }
        const numeric = remaining.match(/^\d+/)?.[0] ?? "";
        if (!numeric) return { kind: remaining ? "format" : "incomplete" };
        const width = part.type === "year" ? 4 : 2;
        if (numeric.length > width) return { kind: "format" };
        remaining = remaining.slice(numeric.length);
        if (part.type === "year" && numeric.length < 4) return { kind: remaining ? "format" : "incomplete" };
        values[part.type] = Number(numeric);
      }
      if (remaining) return { kind: "format" };
      const value = fromParts(values.year ?? 0, values.month ?? 0, values.day ?? 0);
      return value ? { kind: "valid", value } : { kind: "invalid" };
    },
  };
}

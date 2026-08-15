const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateKey = (value: string) => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

const addUtcDays = (date: { year: number; month: number; day: number }, amount: number) => {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

const zonedMidnightMs = (
  date: { year: number; month: number; day: number },
  timezone: string,
) => {
  const desiredAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  let candidate = desiredAsUtc;

  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-hc-h23", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    // Offset convergence handles daylight-saving changes without shipping a
    // timezone database or trusting the device's own timezone.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = formatter.formatToParts(new Date(candidate));
      const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value);
      const representedAsUtc = Date.UTC(
        numberPart("year"),
        numberPart("month") - 1,
        numberPart("day"),
        numberPart("hour"),
        numberPart("minute"),
        numberPart("second"),
      );
      if (!Number.isFinite(representedAsUtc)) return Number.NaN;
      const adjustment = desiredAsUtc - representedAsUtc;
      candidate += adjustment;
      if (adjustment === 0) return candidate;
    }
    return candidate;
  } catch {
    return Number.NaN;
  }
};

/**
 * Quest assignment periods are inclusive Postgres DATE values. A date-only
 * `period_end` therefore expires at the next midnight in the user's timezone.
 * Timestamp-shaped future contracts retain their exact instant semantics.
 */
export const getInclusivePeriodEndMs = (periodEnd: string, timezone: string) => {
  const date = parseDateKey(periodEnd);
  if (DATE_ONLY_PATTERN.test(periodEnd) && !date) return Number.NaN;
  if (!date) return Date.parse(periodEnd);
  return zonedMidnightMs(addUtcDays(date, 1), timezone);
};

import type { OnboardingFormData } from "@/types";

type RhythmAnswers = Pick<
  OnboardingFormData,
  "preferredSessionMinutes" | "preferredReadingTime" | "readingFrequency"
>;
type TasteAnswers = Pick<
  OnboardingFormData,
  "favoriteGenres" | "preferredBookLength" | "preferredBookFormat"
>;
type GoalAnswers = Pick<
  OnboardingFormData,
  "goalTargetBooks" | "goalStartDate" | "goalEndDate"
>;

const readingTimeLabels = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Late night",
  mixed: "Whenever it fits",
};
const frequencyLabels = {
  daily: "Every day",
  weekdays: "On weekdays",
  weekends: "On weekends",
  few_weekly: "A few times a week",
  occasional: "Now and then",
};
const bookFormatLabels = {
  print: "Print books",
  ebook: "E-books",
  audio: "Audiobooks",
  mixed: "A mix of formats",
};
const bookLengthLabels = {
  short: "Under 250 pages",
  medium: "250–400 pages",
  long: "Over 400 pages",
  varied: "Depends on the book",
};

const hasOwn = (values: Record<string, string>, key: string) =>
  Object.prototype.hasOwnProperty.call(values, key);

const labelOrDefault = (labels: Record<string, string>, value: string) =>
  hasOwn(labels, value) ? labels[value] : "No preference yet";

export const getReadingTimeLabel = (value: OnboardingFormData["preferredReadingTime"]) =>
  labelOrDefault(readingTimeLabels, value);

export const getFrequencyLabel = (value: OnboardingFormData["readingFrequency"]) =>
  labelOrDefault(frequencyLabels, value);

export const getBookFormatLabel = (value: OnboardingFormData["preferredBookFormat"]) =>
  labelOrDefault(bookFormatLabels, value);

export const getBookLengthLabel = (value: OnboardingFormData["preferredBookLength"]) =>
  labelOrDefault(bookLengthLabels, value);

export function getSessionValidationMessage(minutes: number | null): string | null {
  return minutes === null || (Number.isInteger(minutes) && minutes >= 5 && minutes <= 300)
    ? null
    : "Choose a whole number from 5 to 300 minutes, or leave it blank.";
}

export function getReadingRhythmSummary(answers: RhythmAnswers): string {
  const { preferredSessionMinutes, preferredReadingTime, readingFrequency } = answers;
  const minutes = Number.isInteger(preferredSessionMinutes) &&
    preferredSessionMinutes !== null && preferredSessionMinutes >= 5 && preferredSessionMinutes <= 300
    ? preferredSessionMinutes
    : null;
  const timePhrases: Record<string, string> = {
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "late at night",
  };
  const time = hasOwn(timePhrases, preferredReadingTime) ? timePhrases[preferredReadingTime] : "";
  const frequency = hasOwn(frequencyLabels, readingFrequency)
    ? frequencyLabels[readingFrequency as keyof typeof frequencyLabels].toLowerCase()
    : "";

  if (!minutes && !time && !frequency) {
    return preferredReadingTime === "mixed"
      ? "Read whenever it fits."
      : "No fixed rhythm yet. Choose what fits your days.";
  }

  const opening = minutes ? `${minutes} minutes${time ? "" : " at a time"}` : "Read";
  const timing = time ? ` ${time}` : "";
  const schedule = frequency
    ? `${minutes || time ? ", " : " "}${frequency}`
    : !time ? ", whenever it fits" : "";
  return `${opening}${timing}${schedule}.`;
}

const joinChoices = (choices: string[]) => {
  if (choices.length <= 2) return choices.join(" and ");
  return `${choices.slice(0, -1).join(", ")}, and ${choices[choices.length - 1]}`;
};

export function getTasteSummary(answers: TasteAnswers): string {
  const genres = [...new Set(answers.favoriteGenres.map((genre) => genre.trim()).filter(Boolean))];
  const parts: string[] = [];
  if (genres.length) parts.push(`Room for ${joinChoices(genres)}.`);

  const formatPhrases: Record<string, string> = {
    print: "Print books feel like home.",
    ebook: "Your shelf travels with you in e-books.",
    audio: "Audiobooks have a place in your reading life.",
    mixed: "There is room for more than one format.",
  };
  const lengthPhrases: Record<string, string> = {
    short: "You lean toward books under 250 pages.",
    medium: "You lean toward books of 250–400 pages.",
    long: "You make room for books over 400 pages.",
    varied: "Length depends on the book, not a rule.",
  };
  if (hasOwn(formatPhrases, answers.preferredBookFormat)) {
    parts.push(formatPhrases[answers.preferredBookFormat]);
  }
  if (hasOwn(lengthPhrases, answers.preferredBookLength)) {
    parts.push(lengthPhrases[answers.preferredBookLength]);
  }
  return parts.join(" ") || "Your shelf can stay open-ended. Pick a few favorites, or explore later.";
}

const DAY_IN_MS = 86_400_000;

// Date inputs represent calendar days, not instants. Strict parsing avoids Date's
// silent rollover (for example, February 30) and UTC avoids DST-length days.
function parseCalendarDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? parsed
    : null;
}

export function getGoalValidationMessage(answers: GoalAnswers): string | null {
  if (answers.goalTargetBooks === null) return "Choose a book target from 1 to 365.";
  if (!Number.isInteger(answers.goalTargetBooks) || answers.goalTargetBooks < 1 || answers.goalTargetBooks > 365) {
    return "Choose a whole number of books from 1 to 365.";
  }
  if (!answers.goalStartDate || !answers.goalEndDate) return "Choose a start and end date to see your pace.";
  const start = parseCalendarDate(answers.goalStartDate);
  const end = parseCalendarDate(answers.goalEndDate);
  if (!start || !end) return "Choose valid start and end dates.";
  if (end.getTime() < start.getTime()) return "Choose an end date on or after your start date.";
  return null;
}

const goalDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function getGoalPaceSummary(answers: GoalAnswers): string {
  const validation = getGoalValidationMessage(answers);
  if (validation) return validation;
  const start = parseCalendarDate(answers.goalStartDate)!;
  const end = parseCalendarDate(answers.goalEndDate)!;
  const target = answers.goalTargetBooks!;
  const days = Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;
  const books = `${target} ${target === 1 ? "book" : "books"}`;
  if (days === 1) return `${books} on ${goalDateFormatter.format(start)} — all within one day.`;
  const period = `${books} between ${goalDateFormatter.format(start)} and ${goalDateFormatter.format(end)}`;
  if (target === 1) return `${period} — ${days} days to read it.`;
  if (target > days) {
    const booksPerDay = Math.round((target / days) * 10) / 10;
    return `${period} — about ${booksPerDay === 1 ? "one" : `${booksPerDay} books`} a day.`;
  }
  const daysPerBook = Math.round(days / target);
  return `${period} — about one ${daysPerBook === 1 ? "a day" : `every ${daysPerBook} days`}.`;
}

const localCalendarDate = (date: Date) =>
  `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Use the reader's local calendar day; clamp Feb 29 to Feb 28 next year. */
export function getDefaultGoalDates(today = new Date()): {
  goalStartDate: string;
  goalEndDate: string;
} {
  if (!Number.isFinite(today.getTime())) throw new RangeError("A valid date is required for the default goal period.");
  const end = new Date(today);
  end.setDate(1);
  end.setFullYear(today.getFullYear() + 1);
  const lastDay = new Date(end);
  lastDay.setMonth(lastDay.getMonth() + 1, 0);
  end.setDate(Math.min(today.getDate(), lastDay.getDate()));
  return { goalStartDate: localCalendarDate(today), goalEndDate: localCalendarDate(end) };
}

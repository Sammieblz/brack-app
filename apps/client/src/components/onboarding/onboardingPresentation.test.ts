import { describe, expect, it } from "vitest";
import {
  getBookFormatLabel,
  getBookLengthLabel,
  getDefaultGoalDates,
  getFrequencyLabel,
  getGoalPaceSummary,
  getGoalValidationMessage,
  getReadingRhythmSummary,
  getReadingTimeLabel,
  getSessionValidationMessage,
  getTasteSummary,
} from "./onboardingPresentation";

describe("onboarding preference labels", () => {
  it("replaces machine values with human wording", () => {
    expect(getFrequencyLabel("few_weekly")).toBe("A few times a week");
    expect(getFrequencyLabel("weekdays")).toBe("On weekdays");
    expect(getReadingTimeLabel("night")).toBe("Late night");
    expect(getReadingTimeLabel("mixed")).toBe("Whenever it fits");
    expect(getBookFormatLabel("ebook")).toBe("E-books");
    expect(getBookFormatLabel("mixed")).toBe("A mix of formats");
    expect(getBookLengthLabel("medium")).toBe("250–400 pages");
    expect(getBookLengthLabel("varied")).toBe("Depends on the book");
  });

  it("does not turn unanswered questions into a preference", () => {
    for (const label of [getFrequencyLabel, getReadingTimeLabel, getBookFormatLabel, getBookLengthLabel]) {
      expect(label("")).toBe("No preference yet");
    }
  });
});

describe("getReadingRhythmSummary", () => {
  it("reflects the actual selected rhythm without predicting results", () => {
    expect(getReadingRhythmSummary({
      preferredSessionMinutes: 20,
      preferredReadingTime: "evening",
      readingFrequency: "few_weekly",
    })).toBe("20 minutes in the evening, a few times a week.");
  });

  it("keeps partial and flexible preferences meaningful", () => {
    expect(getReadingRhythmSummary({
      preferredSessionMinutes: null, preferredReadingTime: "", readingFrequency: "weekends",
    })).toBe("Read on weekends.");
    expect(getReadingRhythmSummary({
      preferredSessionMinutes: 20, preferredReadingTime: "mixed", readingFrequency: "occasional",
    })).toBe("20 minutes at a time, now and then.");
    expect(getReadingRhythmSummary({
      preferredSessionMinutes: null, preferredReadingTime: "mixed", readingFrequency: "",
    })).toBe("Read whenever it fits.");
    expect(getReadingRhythmSummary({
      preferredSessionMinutes: 20, preferredReadingTime: "", readingFrequency: "",
    })).toBe("20 minutes at a time, whenever it fits.");
  });

  it.each([null, 0, -5, 1.5, 301, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not make a rhythm out of empty or invalid session minutes: %s", (preferredSessionMinutes) => {
      expect(getReadingRhythmSummary({
        preferredSessionMinutes, preferredReadingTime: "", readingFrequency: "",
      })).toBe("No fixed rhythm yet. Choose what fits your days.");
    },
  );
});

describe("getSessionValidationMessage", () => {
  it.each([null, 5, 20, 300])("accepts optional or valid session minutes: %s", (minutes) => {
    expect(getSessionValidationMessage(minutes)).toBeNull();
  });
  it.each([0, -1, 4, 301, 12.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid minutes: %s", (minutes) => {
    expect(getSessionValidationMessage(minutes)).toBe("Choose a whole number from 5 to 300 minutes, or leave it blank.");
  });
});

describe("getTasteSummary", () => {
  it("summarizes chosen tastes without claiming recommendations were fetched", () => {
    expect(getTasteSummary({
      favoriteGenres: ["Fantasy", "Mystery", "Fantasy", "  "],
      preferredBookLength: "varied",
      preferredBookFormat: "mixed",
    })).toBe("Room for Fantasy and Mystery. There is room for more than one format. Length depends on the book, not a rule.");
  });
  it("keeps an unanswered shelf open-ended", () => {
    expect(getTasteSummary({ favoriteGenres: [], preferredBookLength: "", preferredBookFormat: "" }))
      .toBe("Your shelf can stay open-ended. Pick a few favorites, or explore later.");
  });
  it("supports a single preference and three genres", () => {
    expect(getTasteSummary({ favoriteGenres: [], preferredBookLength: "short", preferredBookFormat: "" }))
      .toBe("You lean toward books under 250 pages.");
    expect(getTasteSummary({ favoriteGenres: ["Poetry", "Classics", "History"], preferredBookLength: "", preferredBookFormat: "" }))
      .toBe("Room for Poetry, Classics, and History.");
  });
});

describe("goal presentation", () => {
  const goal = { goalTargetBooks: 12, goalStartDate: "2026-01-01", goalEndDate: "2026-12-31" };

  it("expresses a selected target in a concrete calendar pace", () => {
    expect(getGoalValidationMessage(goal)).toBeNull();
    expect(getGoalPaceSummary(goal)).toBe("12 books between Jan 1, 2026 and Dec 31, 2026 — about one every 30 days.");
  });
  it.each([0, -1, 366, 2.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid book targets: %s", (goalTargetBooks) => {
    expect(getGoalValidationMessage({ ...goal, goalTargetBooks })).toBe("Choose a whole number of books from 1 to 365.");
  });
  it("gives neutral guidance while the reader has not chosen target or dates", () => {
    expect(getGoalPaceSummary({ ...goal, goalTargetBooks: null })).toBe("Choose a book target from 1 to 365.");
    expect(getGoalPaceSummary({ ...goal, goalStartDate: null })).toBe("Choose a start and end date to see your pace.");
    expect(getGoalPaceSummary({ ...goal, goalEndDate: "" })).toBe("Choose a start and end date to see your pace.");
  });
  it.each(["2026-02-29", "2024-02-30", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "2026-1-01", "2026-01-01T00:00:00Z", "0000-01-01", "not a date"])(
    "strictly validates calendar dates: %s", (goalStartDate) => {
      expect(getGoalValidationMessage({ ...goal, goalStartDate })).toBe("Choose valid start and end dates.");
    },
  );
  it("validates end dates as strictly as start dates and rejects reversed ranges", () => {
    expect(getGoalValidationMessage({ ...goal, goalEndDate: "2026-02-30" })).toBe("Choose valid start and end dates.");
    expect(getGoalValidationMessage({ ...goal, goalEndDate: "2025-12-31" })).toBe("Choose an end date on or after your start date.");
  });
  it("counts leap days and both endpoints", () => {
    expect(getGoalPaceSummary({ goalTargetBooks: 1, goalStartDate: "2024-02-28", goalEndDate: "2024-03-01" }))
      .toBe("1 book between Feb 28, 2024 and Mar 1, 2024 — 3 days to read it.");
  });
  it.each([["2026-03-07", "2026-03-09"], ["2026-10-31", "2026-11-02"]])(
    "uses calendar days across DST boundaries %s – %s", (goalStartDate, goalEndDate) => {
      expect(getGoalPaceSummary({ goalTargetBooks: 1, goalStartDate, goalEndDate })).toContain("— 3 days to read it.");
    },
  );
  it("does not produce zero-day pace or singular/plural errors for a short goal", () => {
    expect(getGoalPaceSummary({ goalTargetBooks: 1, goalStartDate: "2024-02-29", goalEndDate: "2024-02-29" }))
      .toBe("1 book on Feb 29, 2024 — all within one day.");
    expect(getGoalPaceSummary({ goalTargetBooks: 3, goalStartDate: "2024-02-29", goalEndDate: "2024-02-29" }))
      .toBe("3 books on Feb 29, 2024 — all within one day.");
    expect(getGoalPaceSummary({ goalTargetBooks: 4, goalStartDate: "2026-01-01", goalEndDate: "2026-01-02" }))
      .toContain("about 2 books a day.");
    expect(getGoalPaceSummary({ goalTargetBooks: 2, goalStartDate: "2026-01-01", goalEndDate: "2026-01-02" }))
      .toContain("about one a day.");
  });
});

describe("getDefaultGoalDates", () => {
  it("uses local calendar dates instead of shifting to a UTC day", () => {
    const today = new Date(2026, 8, 10, 23, 55);
    const original = today.getTime();
    expect(getDefaultGoalDates(today)).toEqual({ goalStartDate: "2026-09-10", goalEndDate: "2027-09-10" });
    expect(today.getTime()).toBe(original);
  });
  it("clamps leap day to the last valid February date next year", () => {
    expect(getDefaultGoalDates(new Date(2024, 1, 29))).toEqual({ goalStartDate: "2024-02-29", goalEndDate: "2025-02-28" });
  });
  it("keeps a year-end date in December", () => {
    expect(getDefaultGoalDates(new Date(2026, 11, 31))).toEqual({ goalStartDate: "2026-12-31", goalEndDate: "2027-12-31" });
  });
  it("rejects an invalid supplied clock date", () => {
    expect(() => getDefaultGoalDates(new Date("invalid"))).toThrow(RangeError);
  });
});

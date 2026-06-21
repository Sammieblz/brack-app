import { describe, expect, it } from "vitest";
import type { Book, ReadingSession } from "@/types";
import {
  calculateEstimatedCompletion,
  calculateReadingVelocity,
  getProgressPercentage,
} from "./bookProgress";

const testBook = {
  id: "book-1",
  pages: 200,
  current_page: 50,
  date_started: "2026-06-01",
  status: "reading",
} as Book;

const sessions = [
  {
    id: "session-1",
    book_id: "book-1",
    duration: 60,
    created_at: "2026-06-17T12:00:00.000Z",
  },
] as ReadingSession[];

describe("book progress rules", () => {
  it("caps displayed progress at 100 percent", () => {
    expect(
      getProgressPercentage({ ...testBook, current_page: 250 }),
    ).toBe(100);
  });

  it("calculates reading velocity from persisted sessions", () => {
    expect(calculateReadingVelocity(testBook, sessions)).toBe(50);
  });

  it("does not forecast books already completed", () => {
    expect(
      calculateEstimatedCompletion(
        { ...testBook, status: "completed" },
        sessions,
      ),
    ).toBeNull();
  });
});

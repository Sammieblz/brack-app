import { describe, expect, it, vi } from "vitest";
import {
  advanceJourneyLevelCursor,
  isJourneyLevelObserverRoute,
} from "@/lib/journeyLevelObserver";

describe("JourneyLevelUpObserver guards", () => {
  it("never runs on public, authentication, or onboarding routes", () => {
    expect(isJourneyLevelObserverRoute("/")).toBe(false);
    expect(isJourneyLevelObserverRoute("/auth")).toBe(false);
    expect(isJourneyLevelObserverRoute("/auth/callback")).toBe(false);
    expect(isJourneyLevelObserverRoute("/onboarding")).toBe(false);
    expect(isJourneyLevelObserverRoute("/welcome")).toBe(false);
    expect(isJourneyLevelObserverRoute("/questionnaire")).toBe(false);
    expect(isJourneyLevelObserverRoute("/goals")).toBe(false);
    expect(isJourneyLevelObserverRoute("/unknown-public-link")).toBe(false);
    expect(isJourneyLevelObserverRoute("/dashboard")).toBe(true);
    expect(isJourneyLevelObserverRoute("/achievements")).toBe(true);
    expect(isJourneyLevelObserverRoute("/goals-management")).toBe(true);
    expect(isJourneyLevelObserverRoute("/book/reader-book-id")).toBe(true);
    expect(isJourneyLevelObserverRoute("/lists/reading-list-id")).toBe(true);
  });

  it("advances a durable cursor and returns its previous level", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(advanceJourneyLevelCursor("reader-1", 2, storage)).toBe(0);
    expect(advanceJourneyLevelCursor("reader-1", 3, storage)).toBe(2);
  });

  it("suppresses celebration when the durable cursor cannot be read or written", () => {
    const unreadable = {
      getItem: vi.fn(() => { throw new DOMException("Blocked", "SecurityError"); }),
      setItem: vi.fn(),
    };
    const unwritable = {
      getItem: vi.fn(() => "2"),
      setItem: vi.fn(() => { throw new DOMException("Full", "QuotaExceededError"); }),
    };

    expect(advanceJourneyLevelCursor("reader-1", 3, unreadable)).toBeNull();
    expect(unreadable.setItem).not.toHaveBeenCalled();
    expect(advanceJourneyLevelCursor("reader-1", 3, unwritable)).toBeNull();
  });
});

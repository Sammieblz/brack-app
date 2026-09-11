import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/hooks/useJournalEntries";

const mocks = vi.hoisted(() => ({
  journal: {
    entries: [] as JournalEntry[],
    loading: true,
    refreshing: false,
    hasLoaded: false,
    error: null as string | null,
    refetchEntries: vi.fn(),
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("@/hooks/useJournalEntries", () => ({
  useJournalEntries: () => mocks.journal,
}));
vi.mock("@/components/JournalEntryDialog", () => ({
  JournalEntryDialog: () => null,
}));
vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));
import { JournalEntriesList } from "./JournalEntriesList";
import { TimerPickerContent } from "./HeaderTimerWidget";

afterEach(cleanup);
beforeEach(() => {
  mocks.journal.loading = true;
  mocks.journal.refreshing = false;
  mocks.journal.hasLoaded = false;
  mocks.journal.error = null;
});

describe("nested reader loading", () => {
  it("keeps journal search and add action mounted through initial and empty refresh", () => {
    const view = render(<JournalEntriesList bookId="book" />);
    const search = screen.getByPlaceholderText("Search entries...");
    const add = screen.getByRole("button", { name: "Add Entry" });
    expect(
      view.container.querySelector('[data-loading-contract="journal-entries"]')
        ?.children,
    ).toHaveLength(2);
    expect(
      screen.queryByText("No journal entries yet"),
    ).not.toBeInTheDocument();
    mocks.journal.loading = false;
    mocks.journal.hasLoaded = true;
    view.rerender(<JournalEntriesList bookId="book" />);
    expect(screen.getByPlaceholderText("Search entries...")).toBe(search);
    expect(screen.getByRole("button", { name: "Add Entry" })).toBe(add);
    expect(screen.getByText("No journal entries yet")).toBeInTheDocument();
    mocks.journal.refreshing = true;
    view.rerender(<JournalEntriesList bookId="book" />);
    expect(screen.getByText("No journal entries yet")).toBeInTheDocument();
  });

  it("reserves the timer picker's actual fixed viewport and four cover rows", () => {
    const props = {
      onStartTimer: vi.fn(),
      onGoToLibrary: vi.fn(),
      onAddBook: vi.fn(),
    };
    const view = render(
      <TimerPickerContent {...props} loading readingBooks={[]} />,
    );
    const placeholder = view.container.querySelector(
      '[data-loading-contract="timer-picker"]',
    );
    expect(placeholder).toHaveClass(
      "h-[min(22rem,calc(var(--app-viewport-height,100dvh)-13rem))]",
    );
    expect(placeholder?.children).toHaveLength(4);
    expect(placeholder?.querySelectorAll("button")).toHaveLength(0);
    view.rerender(
      <TimerPickerContent
        {...props}
        loading={false}
        refreshing
        hasLoaded
        readingBooks={[{ id: "book", title: "Current read" }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Current read" }),
    ).toBeInTheDocument();
    expect(
      view.container.querySelector('[data-loading-contract="timer-picker"]'),
    ).not.toBeInTheDocument();
  });
});

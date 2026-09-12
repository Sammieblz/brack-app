import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookSearch } from "./BookSearch";
import { BRACK_LOADER_TIMING } from "./animations/brackLoaderTokens";
import type { GoogleBookResult } from "@/types/googleBooks";

const mocks = vi.hoisted(() => ({
  searchBooks: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/services/api", () => ({ searchBooks: mocks.searchBooks }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));

describe("BookSearch branded wait", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.searchBooks.mockReset();
    mocks.toast.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("uses one centered branded section loader only while a catalog search is pending", async () => {
    let finishSearch: ((value: { books: GoogleBookResult[] }) => void) | undefined;
    mocks.searchBooks.mockReturnValue(new Promise((resolve) => {
      finishSearch = resolve;
    }));

    render(<BookSearch onSelectBook={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search by title, author, or ISBN..."), {
      target: { value: "Beloved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("button", { name: "Searching..." })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs));
    expect(screen.getByRole("status")).toHaveAttribute("data-variant", "section");
    expect(screen.getByRole("status")).toHaveTextContent("Searching Brack's book catalog...");

    await act(async () => {
      finishSearch?.({ books: [] });
      await Promise.resolve();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

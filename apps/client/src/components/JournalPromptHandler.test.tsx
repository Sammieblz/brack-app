import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => ({ id: "reader-a" as string | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: reader.id ? { id: reader.id } : null }) }));

vi.mock("./QuickJournalEntryDialog", () => ({
  QuickJournalEntryDialog: ({ bookTitle, onOpenChange }: {
    bookTitle: string;
    onOpenChange: (open: boolean) => void;
  }) => <div role="dialog" aria-label={bookTitle}>
    <input aria-label="Draft" defaultValue="" />
    <button onClick={() => onOpenChange(false)}>Completed or discarded</button>
  </div>,
}));
import { JournalPromptHandler } from "./JournalPromptHandler";

afterEach(cleanup);
beforeEach(() => { reader.id = "reader-a"; });

const prompt = (bookTitle: string) => act(() => {
  window.dispatchEvent(new CustomEvent("showJournalPrompt", {
    detail: { bookId: bookTitle, bookTitle, durationMinutes: 15 },
  }));
});

describe("journal prompts", () => {
  it("queues new prompts without replacing the current draft, then opens them in order", () => {
    render(<JournalPromptHandler />);
    prompt("First book");
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "Keep this thought" } });
    prompt("Second book");
    prompt("Third book");
    expect(screen.getByRole("dialog", { name: "First book" })).toBeTruthy();
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("Keep this thought");
    fireEvent.click(screen.getByText("Completed or discarded"));
    expect(screen.getByRole("dialog", { name: "Second book" })).toBeTruthy();
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByText("Completed or discarded"));
    expect(screen.getByRole("dialog", { name: "Third book" })).toBeTruthy();
    fireEvent.click(screen.getByText("Completed or discarded"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("removes the event listener when the handler unmounts", () => {
    const first = render(<JournalPromptHandler />);
    first.unmount();
    prompt("Unmounted book");
    render(<JournalPromptHandler />);
    expect(screen.queryByRole("dialog")).toBeNull();
    prompt("Current book");
    expect(screen.getByRole("dialog", { name: "Current book" })).toBeTruthy();
  });

  it("clears open and queued book context when the authenticated reader changes", () => {
    const view = render(<JournalPromptHandler />);
    prompt("Private first book");
    prompt("Private queued book");
    reader.id = "reader-b";
    view.rerender(<JournalPromptHandler />);
    expect(screen.queryByRole("dialog")).toBeNull();
    prompt("Other reader's book");
    expect(screen.getByRole("dialog", { name: "Other reader's book" })).toBeTruthy();
    reader.id = "reader-a";
    view.rerender(<JournalPromptHandler />);
    expect(screen.queryByRole("dialog")).toBeNull();
    reader.id = null;
    view.rerender(<JournalPromptHandler />);
    prompt("Signed-out event");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

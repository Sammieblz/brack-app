import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { QuickProgressWidget } from "./QuickProgressWidget";

const boundary = vi.hoisted(() => ({
  update: vi.fn(),
  auth: { user: { id: "reader-one" } as { id: string } | null, loading: false },
}));
vi.mock("@/services/api", () => ({ updateBookQuickProgress: boundary.update }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => boundary.auth }));

const book = { id: "book-one", user_id: "reader-one", current_page: 42, pages: 300, status: "reading" } as Book;
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const changePage = (value: string) => fireEvent.change(screen.getByLabelText("Current Page", { exact: true }), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole("form", { name: "Correct current page" }));

beforeEach(() => {
  boundary.update.mockReset();
  boundary.update.mockResolvedValue(undefined);
  boundary.auth = { user: { id: "reader-one" }, loading: false };
});
afterEach(cleanup);

describe("owned page corrections", () => {
  it.each(["", "-1", "1.5", "1e2", "Infinity", "301", "9007199254740992"])("rejects impossible page input %j without coercing or writing it", async value => {
    render(<QuickProgressWidget book={book} onUpdate={vi.fn()} />);
    changePage(value);
    submit();
    expect(boundary.update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByLabelText("Current Page")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Current Page")).toHaveFocus();
  });

  it("locks pending input and duplicate intent, retains a failed draft, and retries once", async () => {
    const request = deferred();
    boundary.update.mockReturnValueOnce(request.promise);
    const refresh = vi.fn();
    render(<QuickProgressWidget book={book} onUpdate={refresh} />);
    changePage("58");
    submit(); submit();
    expect(boundary.update).toHaveBeenCalledExactlyOnceWith(book, 58);
    expect(screen.getByLabelText("Current Page")).toBeDisabled();
    await act(async () => request.reject(new Error("Local storage is unavailable.")));
    expect(screen.getByLabelText("Current Page")).toHaveValue("58");
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't save");
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => submit());
    expect(boundary.update).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Page 58 saved on this device");
    expect(screen.getByRole("button", { name: "Correct page" })).toBeDisabled();
  });

  it("accepts an intentional zero correction and unknown totals without invented percentages", async () => {
    render(<QuickProgressWidget book={{ ...book, pages: null }} onUpdate={vi.fn()} />);
    changePage("0");
    await act(async () => submit());
    expect(boundary.update).toHaveBeenCalledWith(expect.objectContaining({ pages: null }), 0);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText(/do not add reading activity or streaks/)).toBeVisible();
  });

  it("communicates completion before saving the last page and retains completed status semantics", () => {
    const view = render(<QuickProgressWidget book={book} onUpdate={vi.fn()} />);
    changePage("300");
    expect(screen.getByText(/also marks this book finished/)).toBeVisible();
    view.rerender(<QuickProgressWidget book={{ ...book, status: "completed", current_page: 300 }} onUpdate={vi.fn()} />);
    changePage("200");
    expect(screen.getByText(/keeps its finished status/)).toBeVisible();
    view.rerender(<QuickProgressWidget book={{ ...book, status: "completed", current_page: 100 }} onUpdate={vi.fn()} />);
    expect(screen.getByText(/keeps its finished status/)).toBeVisible();
  });

  it("follows refreshed progress only while clean and retains edited input on refresh", () => {
    const view = render(<QuickProgressWidget book={book} onUpdate={vi.fn()} />);
    view.rerender(<QuickProgressWidget book={{ ...book, current_page: 50 }} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Current Page")).toHaveValue("50");
    changePage("70");
    view.rerender(<QuickProgressWidget book={{ ...book, current_page: 60 }} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Current Page")).toHaveValue("70");
    expect(screen.getByText("Saved page 60 of 300")).toBeVisible();
  });

  it.each(["book", "account", "loading", "unmount"])("withdraws obsolete pending UI ownership after %s changes", async reason => {
    const request = deferred();
    boundary.update.mockReturnValue(request.promise);
    const refresh = vi.fn();
    const view = render(<QuickProgressWidget book={book} onUpdate={refresh} />);
    changePage("58"); submit();
    if (reason === "book") view.rerender(<QuickProgressWidget book={{ ...book, id: "book-two", current_page: 12 }} onUpdate={refresh} />);
    if (reason === "account") {
      boundary.auth = { user: { id: "reader-two" }, loading: false };
      view.rerender(<QuickProgressWidget book={{ ...book, user_id: "reader-two", current_page: 14 }} onUpdate={refresh} />);
    }
    if (reason === "loading") {
      boundary.auth = { user: { id: "reader-one" }, loading: true };
      view.rerender(<QuickProgressWidget book={book} onUpdate={refresh} />);
    }
    if (reason === "unmount") view.unmount();
    await act(async () => request.resolve());
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/Page 58 saved/)).not.toBeInTheDocument();
  });

  it("does not represent a refresh failure as an unsaved correction", async () => {
    render(<QuickProgressWidget book={book} onUpdate={() => Promise.reject(new Error("Refresh unavailable"))} />);
    changePage("80");
    await act(async () => submit());
    expect(boundary.update).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Page 80 saved on this device");
    expect(screen.getByRole("status")).toHaveTextContent("couldn't refresh");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Correct page" })).toBeDisabled();
  });

  it("uses unique label associations for repeated instances and denies another account's book", () => {
    render(<><QuickProgressWidget book={book} onUpdate={vi.fn()} /><QuickProgressWidget book={{ ...book, id: "other", user_id: "reader-two" }} onUpdate={vi.fn()} /></>);
    const fields = screen.getAllByLabelText("Current Page");
    expect(fields[0].id).not.toBe(fields[1].id);
    expect(fields[1]).toBeDisabled();
    fireEvent.change(fields[1], { target: { value: "61" } });
    fireEvent.submit(screen.getAllByRole("form")[1]);
    expect(boundary.update).not.toHaveBeenCalled();
  });
});

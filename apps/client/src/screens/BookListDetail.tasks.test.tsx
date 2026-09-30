import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, BookList } from "@/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requestOverlayBack } from "@/lib/backLayers";

const state = vi.hoisted(() => ({
  userId: "reader", authLoading: false,
  fetchLists: vi.fn(), fetchBooks: vi.fn(), remove: vi.fn(), reorder: vi.fn(), toast: vi.fn(),
  library: [] as Book[], fetchMemberships: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: state.userId }, loading: state.authLoading }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/services/api", () => ({
  BOOK_LISTS_CHANGED_EVENT: "list-detail-test-change",
  fetchBookListsPage: state.fetchLists, fetchListBooks: state.fetchBooks,
  getApiErrorStatus: (error: { status?: number }) => error?.status ?? null,
  createBookList: vi.fn(), updateBookList: vi.fn(), deleteBookList: vi.fn(), duplicateBookList: vi.fn(),
  addBookToList: vi.fn(), fetchBookIdsInList: state.fetchMemberships,
  removeBookFromList: state.remove, reorderBookListItems: state.reorder,
}));
vi.mock("@/services/api/bookLists", () => ({ removeBookFromList: state.remove, reorderBookListItems: state.reorder }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
// Keep the real membership task to verify route-owner continuity; its Library
// collection is a data boundary separate from the real list read hooks here.
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: state.library, loading: false, error: null,
  hasLoaded: true, hasMore: false, loadingMore: false, loadMore: vi.fn(), refetchBooks: vi.fn() }) }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: ({ title, action }: { title: string; action: ReactNode }) => <div><h2>{title}</h2>{action}</div> }));
import BookListDetail from "./BookListDetail";

const list = { id: "list-a", user_id: "reader", name: "Weekend", description: "Quiet reading", book_count: 2 } as BookList;
const first = { id: "book-a", user_id: "reader", title: "First book", author: "First author", status: "to_read" } as Book;
const second = { ...first, id: "book-b", title: "Second book" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const view = () => <MemoryRouter initialEntries={["/lists/list-a"]}>
  <TooltipProvider><Routes><Route path="/lists/:listId" element={<BookListDetail />} /></Routes></TooltipProvider>
</MemoryRouter>;
const startRemoval = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Remove First book from list" }));
  const dialog = screen.getByRole("dialog", { name: "Remove from list?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  return dialog;
};
beforeEach(() => {
  vi.resetAllMocks(); state.userId = "reader"; state.authLoading = false;
  state.fetchLists.mockResolvedValue({ lists: [list], hasMore: false });
  state.fetchBooks.mockResolvedValue([first, second]);
  state.library = [first, second]; state.fetchMemberships.mockResolvedValue([]);
  state.remove.mockResolvedValue(undefined); state.reorder.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("BookListDetail removal ownership", () => {
  it("retains one pending removal through list refresh and dismissal, then keeps rejection for explicit retry", async () => {
    const pending = deferred<void>(); state.remove.mockReturnValueOnce(pending.promise);
    render(view());
    const dialog = await startRemoval();
    const confirm = within(dialog).getByRole("button", { name: /Removing/ });
    fireEvent.click(confirm); expect(state.remove).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    act(() => { requestOverlayBack(); });
    expect(dialog).toBeInTheDocument();

    // The real service emits this event before its returned Promise settles.
    state.fetchLists.mockResolvedValue({ lists: [{ ...list, book_count: 1 }], hasMore: false });
    act(() => { window.dispatchEvent(new CustomEvent("list-detail-test-change", { detail: { userId: "reader" } })); });
    await waitFor(() => expect(state.fetchLists).toHaveBeenCalledTimes(2));
    expect(dialog).toBeInTheDocument(); expect(state.toast).not.toHaveBeenCalled();
    await act(async () => pending.reject(new Error("Local removal failed")));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Local removal failed");
    expect(screen.getByRole("button", { name: "Remove First book from list", hidden: true })).toBeInTheDocument();

    state.fetchBooks.mockResolvedValue([second]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(state.remove).toHaveBeenCalledTimes(2);
    expect(state.remove).toHaveBeenLastCalledWith("list-a", "book-a");
    expect(screen.queryByRole("button", { name: "Remove First book from list" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Second book from list" })).toBeInTheDocument();
    expect(state.toast).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Books" })).toHaveFocus());
  });

  it("keeps confirmed removal separate from refresh failure and retries the read without deleting twice", async () => {
    render(view()); await screen.findByRole("button", { name: "Remove First book from list" });
    state.fetchBooks.mockRejectedValueOnce(new Error("Read unavailable"));
    await startRemoval();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load the books");
    expect(screen.queryByRole("button", { name: "Remove First book from list" })).not.toBeInTheDocument();
    expect(state.toast).toHaveBeenCalledOnce(); expect(state.remove).toHaveBeenCalledOnce();
    state.fetchBooks.mockResolvedValue([second]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove First book from list" })).not.toBeInTheDocument();
    expect(state.remove).toHaveBeenCalledOnce(); expect(state.toast).toHaveBeenCalledOnce();
  });

  it("returns focus to the surviving page control when the last row is removed", async () => {
    state.fetchBooks.mockResolvedValueOnce([first]).mockResolvedValue([]);
    render(view()); await startRemoval();
    await screen.findByRole("heading", { name: "No books in this list yet" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Books" })).toHaveFocus());
    expect(state.remove).toHaveBeenCalledOnce(); expect(state.toast).toHaveBeenCalledOnce();
  });

  it.each(["account", "unmount"])("suppresses obsolete removal feedback and refresh after %s abandonment", async mode => {
    const pending = deferred<void>(); state.remove.mockReturnValueOnce(pending.promise);
    const rendered = render(view()); await startRemoval();
    if (mode === "account") {
      state.userId = "other-reader"; state.fetchBooks.mockResolvedValue([second]);
      rendered.rerender(view());
      await screen.findByRole("button", { name: "Remove Second book from list" });
    } else rendered.unmount();
    const reads = state.fetchBooks.mock.calls.length;
    await act(async () => pending.resolve());
    expect(state.fetchBooks).toHaveBeenCalledTimes(reads);
    expect(state.toast).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows a later authoritative read to show a legitimately re-added book after removal was acknowledged", async () => {
    render(view()); await screen.findByRole("button", { name: "Remove First book from list" });
    state.fetchBooks.mockResolvedValue([second]); await startRemoval();
    await waitFor(() => expect(state.fetchBooks).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    state.fetchLists.mockRejectedValueOnce(new Error("Collection refresh unavailable"));
    act(() => { window.dispatchEvent(new CustomEvent("list-detail-test-change", { detail: { userId: "reader" } })); });
    await screen.findByRole("alert");
    state.fetchBooks.mockResolvedValue([first, second]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Remove First book from list" });
    expect(state.remove).toHaveBeenCalledOnce(); expect(state.toast).toHaveBeenCalledOnce();
  });
});

describe("BookListDetail paginated list lookup", () => {
  it("retains the live selected-books task while a known later page reloads, fails and is refreshed again", async () => {
    const earlier = { ...list, id: "earlier-list" };
    state.fetchLists.mockImplementation((_user: string, offset: number) => Promise.resolve(offset === 0
      ? { lists: [earlier], hasMore: true } : { lists: [list], hasMore: false }));
    render(view());
    fireEvent.click(await screen.findByRole("button", { name: "Add Books" }));
    const dialog = await screen.findByRole("dialog", { name: "Add Books to List" });
    const checkbox = await within(dialog).findByRole("checkbox", { name: "First book" });
    fireEvent.click(checkbox); checkbox.focus();
    const page = deferred<{ lists: BookList[]; hasMore: boolean }>();
    state.fetchLists.mockImplementation((_user: string, offset: number) => offset === 0
      ? Promise.resolve({ lists: [earlier], hasMore: true }) : page.promise);
    act(() => { window.dispatchEvent(new CustomEvent("list-detail-test-change", { detail: { userId: "reader" } })); });
    await waitFor(() => expect(state.fetchLists).toHaveBeenCalledTimes(4));
    expect(screen.getByRole("dialog", { name: "Add Books to List" })).toBe(dialog);
    expect(within(dialog).getByRole("checkbox", { name: "First book" })).toBe(checkbox);
    expect(checkbox).toBeChecked(); expect(checkbox).toHaveFocus();

    await act(async () => page.reject(new Error("Later page unavailable")));
    expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent("couldn't load your book lists");
    expect(screen.getByRole("dialog", { name: "Add Books to List" })).toBe(dialog);
    expect(checkbox).toBeChecked(); expect(state.fetchMemberships).toHaveBeenCalledOnce();

    state.fetchLists.mockImplementation((_user: string, offset: number) => Promise.resolve(offset === 0
      ? { lists: [earlier], hasMore: true } : { lists: [{ ...list, name: "Updated weekend" }], hasMore: false }));
    act(() => { window.dispatchEvent(new CustomEvent("list-detail-test-change", { detail: { userId: "reader" } })); });
    await screen.findByRole("heading", { name: "Updated weekend", hidden: true });
    expect(screen.getByRole("dialog", { name: "Add Books to List" })).toBe(dialog);
    expect(checkbox).toBeChecked(); expect(checkbox).toHaveFocus();
    expect(screen.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
    expect(state.fetchLists).toHaveBeenCalledTimes(6); expect(state.fetchMemberships).toHaveBeenCalledOnce();
  });

  it.each(["missing", "permission"])("abandons retained metadata and its task after a confirmed %s result", async outcome => {
    render(view()); fireEvent.click(await screen.findByRole("button", { name: "Add Books" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "First book" }));
    if (outcome === "missing") state.fetchLists.mockResolvedValue({ lists: [], hasMore: false });
    else state.fetchLists.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    act(() => { window.dispatchEvent(new CustomEvent("list-detail-test-change", { detail: { userId: "reader" } })); });
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(outcome === "missing" ? "could not be found" : "no longer available");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Books" })).not.toBeInTheDocument();

    state.fetchLists.mockResolvedValue({ lists: [list], hasMore: false });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const trigger = await screen.findByRole("button", { name: "Add Books" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(await screen.findByRole("checkbox", { name: "First book" })).not.toBeChecked();
  });

  it("finds a real list beyond the first page without reporting a missing list", async () => {
    const page = deferred<{ lists: BookList[]; hasMore: boolean }>();
    state.fetchLists.mockResolvedValueOnce({ lists: [{ ...list, id: "earlier-list" }], hasMore: true })
      .mockReturnValueOnce(page.promise);
    render(view());
    await waitFor(() => expect(state.fetchLists).toHaveBeenCalledWith("reader", 15, 15));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Books" })).not.toBeInTheDocument();
    await act(async () => page.resolve({ lists: [list], hasMore: false }));
    await screen.findByRole("button", { name: "Remove First book from list" });
    expect(state.fetchLists).toHaveBeenCalledTimes(2); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops a failed later-page lookup and resumes only after an explicit retry", async () => {
    state.fetchLists.mockImplementation((_user: string, offset: number) => offset === 0
      ? Promise.resolve({ lists: [{ ...list, id: "earlier-list" }], hasMore: true })
      : Promise.reject(new Error("Second page unavailable")));
    render(view());
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your book lists");
    expect(state.fetchLists).toHaveBeenCalledTimes(2);
    state.fetchLists.mockImplementation((_user: string, offset: number) => Promise.resolve(offset === 0
      ? { lists: [{ ...list, id: "earlier-list" }], hasMore: true }
      : { lists: [list], hasMore: false }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Remove First book from list" });
    expect(state.fetchLists).toHaveBeenCalledTimes(4); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

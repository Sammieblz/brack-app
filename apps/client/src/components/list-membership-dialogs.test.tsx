import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddToListDialog } from "./AddToListDialog";
import { AddBooksToListDialog } from "./AddBooksToListDialog";

const mocks = vi.hoisted(() => ({
  user: { id: "reader" }, authLoading: false,
  membership: vi.fn(), existingBooks: vi.fn(), add: vi.fn(), remove: vi.fn(), addOne: vi.fn(),
  toast: vi.fn(), haptic: vi.fn(), refetchLists: vi.fn(), refetchBooks: vi.fn(), loadMore: vi.fn(),
  catalog: { lists: [{ id: "list-1", name: "Quiet evenings", description: "Books for a calm night" }], loading: false, hasLoaded: true, error: null as string | null, hasMore: false, loadingMore: false },
  library: { books: [{ id: "book-1", title: "First book", author: "One", genre: null, cover_url: null }, { id: "book-2", title: "Second book", author: "Two", genre: null, cover_url: null }], loading: false, hasLoaded: true, error: null as string | null, hasMore: false, loadingMore: false },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }) }));
vi.mock("@/hooks/useBookLists", () => ({ useBookLists: () => ({ ...mocks.catalog, addBookToList: mocks.add, removeBookFromList: mocks.remove, refetch: mocks.refetchLists, loadMore: mocks.loadMore }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ ...mocks.library, refetchBooks: mocks.refetchBooks, loadMore: mocks.loadMore }) }));
vi.mock("@/services/api", () => ({ fetchListIdsContainingBook: mocks.membership, fetchBookIdsInList: mocks.existingBooks, addBookToList: mocks.addOne }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const wrap = (node: React.ReactNode) => <MemoryRouter initialEntries={["/book/book-1"]}>{node}<Location /></MemoryRouter>;
const openMembership = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
  return screen.findByRole("checkbox", { name: "Quiet evenings" });
};
const openBooks = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Add Books" }));
  return screen.findByRole("checkbox", { name: "First book" });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "reader" }; mocks.authLoading = false;
  Object.assign(mocks.catalog, { lists: [{ id: "list-1", name: "Quiet evenings", description: "Books for a calm night" }], loading: false, hasLoaded: true, error: null, hasMore: false, loadingMore: false });
  Object.assign(mocks.library, { books: [{ id: "book-1", title: "First book", author: "One", genre: null, cover_url: null }, { id: "book-2", title: "Second book", author: "Two", genre: null, cover_url: null }], loading: false, hasLoaded: true, error: null, hasMore: false, loadingMore: false });
  mocks.membership.mockReset().mockResolvedValue([]);
  mocks.existingBooks.mockReset().mockResolvedValue([]);
  mocks.add.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  mocks.addOne.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("single-book list membership", () => {
  it("does not present unknown membership as unchecked and retries a failed lookup", async () => {
    const lookup = deferred<string[]>(); mocks.membership.mockReturnValueOnce(lookup.promise).mockResolvedValueOnce(["list-1"]);
    render(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    expect(screen.getByRole("status")).toHaveTextContent("Checking list membership");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => lookup.reject(new Error("Lookup unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't check");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry membership" }));
    expect(await screen.findByRole("checkbox", { name: "Quiet evenings" })).toBeChecked();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it.each([true, false])("serializes a membership update to %s, refuses pending dismissal, retains rejection and confirms retry", async (adding) => {
    mocks.membership.mockResolvedValue(adding ? [] : ["list-1"]);
    const save = deferred<void>(); const mutate = adding ? mocks.add : mocks.remove;
    mutate.mockReturnValueOnce(save.promise);
    render(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    const checkbox = await openMembership();
    act(() => { fireEvent.click(checkbox); fireEvent.click(checkbox); });
    expect(mutate).toHaveBeenCalledExactlyOnceWith("list-1", "book-1");
    expect(checkbox).toBeDisabled();
    fireEvent.keyDown(checkbox, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("dialog", { name: "Add to Lists" })).toBeInTheDocument();
    await act(async () => save.reject(new Error("Membership unavailable")));
    expect(checkbox).toHaveAccessibleDescription(/Membership unavailable/);
    expect(checkbox).toHaveAttribute("aria-checked", String(!adding));
    expect(mocks.toast).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toHaveAttribute("aria-checked", String(adding)));
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it("ignores a previous opening's lookup after close and reopen", async () => {
    const old = deferred<string[]>(); mocks.membership.mockReturnValueOnce(old.promise).mockResolvedValueOnce(["list-1"]);
    render(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const checkbox = await openMembership();
    expect(checkbox).toBeChecked();
    await act(async () => old.resolve([]));
    expect(checkbox).toBeChecked();
  });

  it.each(["book", "account", "auth loading"])("withdraws the old task after %s changes and ignores its late write", async (change) => {
    const save = deferred<void>(); mocks.add.mockReturnValueOnce(save.promise);
    const view = render(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    fireEvent.click(await openMembership());
    if (change === "account") mocks.user = { id: "next-reader" };
    if (change === "auth loading") mocks.authLoading = true;
    view.rerender(wrap(<AddToListDialog userId={mocks.user.id} bookId={change === "book" ? "book-2" : "book-1"} />));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => save.resolve());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps catalog failure distinct from an empty catalog and uses internal Create a List navigation", async () => {
    Object.assign(mocks.catalog, { lists: [], hasLoaded: false, error: "Lists unavailable" });
    const view = render(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Lists unavailable");
    expect(screen.queryByRole("link", { name: "Create a List" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry lists" }));
    expect(mocks.refetchLists).toHaveBeenCalledOnce();
    Object.assign(mocks.catalog, { hasLoaded: true, error: null });
    view.rerender(wrap(<AddToListDialog userId="reader" bookId="book-1" />));
    const create = await screen.findByRole("link", { name: "Create a List" });
    expect(create).toHaveAttribute("href", "/lists");
    fireEvent.click(create);
    expect(screen.getByTestId("location")).toHaveTextContent("/lists");
  });
});

describe("adding selected books to a list", () => {
  it("requires successful membership lookup and exposes retry instead of a false empty list", async () => {
    mocks.existingBooks.mockRejectedValueOnce(new Error("Lookup unavailable")).mockResolvedValueOnce(["book-2"]);
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add Books" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't check");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.queryByText("All your books are already in this list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry membership" }));
    expect(await screen.findByRole("checkbox", { name: "First book" })).toBeEnabled();
    expect(screen.queryByRole("checkbox", { name: "Second book" })).not.toBeInTheDocument();
  });

  it("retains only unconfirmed selection after partial failure and retries without replaying a confirmed add", async () => {
    const first = deferred<void>(); mocks.addOne.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error("Second add unavailable"));
    const refresh = vi.fn(); render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" onBooksAdded={refresh} />));
    const firstBook = await openBooks(); fireEvent.click(firstBook);
    fireEvent.click(screen.getByRole("checkbox", { name: "Second book" }));
    const add = screen.getByRole("button", { name: "Add (2)" });
    act(() => { fireEvent.click(add); fireEvent.click(add); });
    expect(mocks.addOne).toHaveBeenCalledExactlyOnceWith("list-1", "book-1");
    expect(firstBook).toBeDisabled(); expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(add, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Add Books to List" })).toBeInTheDocument();
    await act(async () => first.resolve());
    expect(await screen.findByRole("alert")).toHaveTextContent("1 book(s) added. Second add unavailable");
    expect(screen.queryByRole("checkbox", { name: "First book" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Second book" })).toBeChecked();
    expect(refresh).toHaveBeenCalledOnce(); expect(mocks.toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add (1)" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.addOne.mock.calls).toEqual([["list-1", "book-1"], ["list-1", "book-2"], ["list-1", "book-2"]]);
    expect(refresh).toHaveBeenCalledTimes(2); expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it("notifies the parent about a partial commit even if refresh rejects, retaining the remaining selection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.addOne.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Membership unavailable"));
    const refresh = vi.fn().mockRejectedValue(new Error("Parent refresh unavailable"));
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" onBooksAdded={refresh} />));
    fireEvent.click(await openBooks()); fireEvent.click(screen.getByRole("checkbox", { name: "Second book" }));
    fireEvent.click(screen.getByRole("button", { name: "Add (2)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 book(s) added. Membership unavailable");
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("checkbox", { name: "Second book" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Add (1)" })).toBeEnabled();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Parent refresh unavailable");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("retains selection when dirty dismissal is declined and clears it only after explicit discard", async () => {
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" />));
    fireEvent.click(await openBooks()); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const confirmation = screen.getByRole("dialog", { name: "Discard book selection?" });
    expect(within(confirmation).getByRole("button", { name: "Keep selecting" })).toHaveFocus();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Keep selecting" }));
    expect(screen.getByRole("checkbox", { name: "First book" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard selection" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await openBooks()).not.toBeChecked();
  });

  it("stops an abandoned sequential add before sending the next book or reporting success", async () => {
    const save = deferred<void>(); mocks.addOne.mockReturnValueOnce(save.promise);
    const refresh = vi.fn(); const view = render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" onBooksAdded={refresh} />));
    fireEvent.click(await openBooks()); fireEvent.click(screen.getByRole("checkbox", { name: "Second book" }));
    fireEvent.click(screen.getByRole("button", { name: "Add (2)" }));
    view.unmount();
    await act(async () => save.resolve());
    expect(mocks.addOne).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("closes controlled ownership on list change and ignores its previous lookup", async () => {
    const lookup = deferred<string[]>(); mocks.existingBooks.mockReturnValueOnce(lookup.promise);
    const changed = vi.fn();
    const view = render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" open onOpenChange={changed} trigger={null} />));
    await waitFor(() => expect(mocks.existingBooks).toHaveBeenCalledOnce());
    view.rerender(wrap(<AddBooksToListDialog userId="reader" listId="list-2" open onOpenChange={changed} trigger={null} />));
    expect(changed).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => lookup.resolve(["book-1"]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not report failed membership when the parent refresh rejects after confirmed additions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const refresh = vi.fn().mockRejectedValue(new Error("Refresh unavailable"));
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" onBooksAdded={refresh} />));
    fireEvent.click(await openBooks()); fireEvent.click(screen.getByRole("button", { name: "Add (1)" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: "Books added" }));
    expect(mocks.addOne).toHaveBeenCalledOnce();
  });

  it("isolates a reopened task from a forced-closed pending write and preserves the new submit lock", async () => {
    const oldSave = deferred<void>(); const newSave = deferred<void>();
    mocks.addOne.mockReturnValueOnce(oldSave.promise).mockReturnValueOnce(newSave.promise);
    const close = vi.fn(); const refresh = vi.fn();
    const task = (open: boolean) => wrap(<AddBooksToListDialog userId="reader" listId="list-1" open={open} onOpenChange={close} onBooksAdded={refresh} trigger={null} />);
    const view = render(task(true));
    fireEvent.click(await screen.findByRole("checkbox", { name: "First book" }));
    fireEvent.click(screen.getByRole("button", { name: "Add (1)" }));
    view.rerender(task(false)); view.rerender(task(true));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Second book" }));
    fireEvent.click(screen.getByRole("button", { name: "Add (1)" }));
    await act(async () => oldSave.resolve());
    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Second book" })).toBeChecked();
    fireEvent.keyDown(screen.getByRole("button", { name: "Adding..." }), { key: "Escape" });
    expect(close).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled(); expect(mocks.addOne).toHaveBeenCalledTimes(2);
    await act(async () => newSave.resolve());
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
    expect(refresh).toHaveBeenCalledOnce(); expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it("ignores a previous closed opening's membership lookup after a fresh selection", async () => {
    const oldLookup = deferred<string[]>();
    mocks.existingBooks.mockReturnValueOnce(oldLookup.promise).mockResolvedValueOnce([]);
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add Books" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const firstBook = await openBooks(); fireEvent.click(firstBook);
    await act(async () => oldLookup.resolve(["book-1"]));
    expect(firstBook).toBeInTheDocument(); expect(firstBook).toBeChecked();
    expect(screen.getByRole("button", { name: "Add (1)" })).toBeEnabled();
  });

  it("keeps a failed initial library read distinct from an empty library and offers retry", async () => {
    Object.assign(mocks.library, { books: [], hasLoaded: false, error: "Library unavailable" });
    render(wrap(<AddBooksToListDialog userId="reader" listId="list-1" />));
    fireEvent.click(screen.getByRole("button", { name: "Add Books" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Library unavailable");
    expect(screen.queryByText("Your library has no books to add yet.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry library" }));
    expect(mocks.refetchBooks).toHaveBeenCalledOnce();
  });
});

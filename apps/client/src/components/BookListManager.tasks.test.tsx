import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookList } from "@/types";
import { requestOverlayBack } from "@/lib/backLayers";

const state = vi.hoisted(() => ({
  lists: [] as BookList[], loading: false, refreshing: false, hasLoaded: true,
  loadingMore: false, hasMore: false, error: null,
  loadMore: vi.fn(), refetch: vi.fn(), createList: vi.fn(), updateList: vi.fn(), deleteList: vi.fn(), duplicateList: vi.fn(),
  toast: vi.fn(), haptic: vi.fn(),
}));
vi.mock("@/hooks/useBookLists", () => ({ useBookLists: () => state }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: state.haptic }) }));
vi.mock("@/hooks/useInfiniteScroll", () => ({ useInfiniteScroll: () => ({ current: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: ({ title, action }: { title: string; action: ReactNode }) => <div><h2>{title}</h2>{action}</div> }));
import { BookListManager } from "./BookListManager";

const list = { id: "list-a", user_id: "reader", name: "Weekend", description: "Quiet reading", book_count: 2, is_public: false, created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z" } as BookList;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const view = (userId = "reader") => <MemoryRouter><BookListManager userId={userId} /></MemoryRouter>;
const menuAction = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Weekend" }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name }));
};
const openCreate = () => fireEvent.click(screen.getByRole("button", { name: "Create List" }));
const draft = () => {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Summer" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Long afternoons" } });
};
beforeEach(() => {
  vi.resetAllMocks(); state.lists = [list]; state.refreshing = false;
  state.createList.mockResolvedValue({ ...list, name: "Summer" });
  state.updateList.mockResolvedValue(undefined); state.deleteList.mockResolvedValue(undefined);
  state.duplicateList.mockResolvedValue({ ...list, id: "copy", name: "Weekend (Copy)" });
});
afterEach(cleanup);

describe("BookListManager task ownership", () => {
  it.each(["create", "edit"])("%s serializes submits and retains failed fields until a successful retry", async mode => {
    const pending = deferred<BookList | void>();
    const mutate = mode === "create" ? state.createList : state.updateList;
    mutate.mockReturnValueOnce(pending.promise);
    render(view()); if (mode === "create") openCreate(); else await menuAction("Edit");
    draft(); const name = screen.getByLabelText("Name"); const form = name.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(mutate).toHaveBeenCalledOnce(); expect(name).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => { requestOverlayBack(); });
    expect(screen.getByRole("dialog", { name: mode === "create" ? "Create List" : "Edit List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => pending.reject(new Error("Local write unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be");
    expect(name).toHaveValue("Summer"); expect(screen.getByLabelText("Description")).toHaveValue("Long afternoons");
    expect(state.toast).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mutate).toHaveBeenCalledTimes(2); expect(state.toast).toHaveBeenCalledOnce();
    openCreate(); expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps a dirty editor through cancellation and explicitly discards before an ordinary clean reopen", async () => {
    render(view()); openCreate(); draft();
    const input = screen.getByLabelText("Name");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: "Discard list changes?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(input).toHaveValue("Summer");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    openCreate(); expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(state.createList).not.toHaveBeenCalled();
  });

  it("preserves the same editor fields when the list collection refreshes", async () => {
    const rendered = render(view()); await menuAction("Edit"); draft();
    const input = screen.getByLabelText("Name"); input.focus();
    (input as HTMLInputElement).setSelectionRange(1, 3);
    state.refreshing = true; rendered.rerender(view());
    expect(screen.getByLabelText("Name")).toBe(input); expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionStart).toBe(1); expect(input).toHaveValue("Summer");
  });

  it("retains a rejected delete confirmation, blocks duplicate/dismissal and allows one explicit retry", async () => {
    const pending = deferred<void>(); state.deleteList.mockReturnValueOnce(pending.promise);
    render(view()); await menuAction("Delete");
    const dialog = screen.getByRole("dialog", { name: "Delete list?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    const button = within(dialog).getByRole("button", { name: "Delete" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(state.deleteList).toHaveBeenCalledOnce(); expect(button).toBeDisabled();
    act(() => { requestOverlayBack(); }); expect(dialog).toBeInTheDocument();
    await act(async () => pending.reject(new Error("Local delete failed")));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("could not be deleted"); expect(state.toast).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(state.deleteList).toHaveBeenCalledTimes(2); expect(state.toast).toHaveBeenCalledOnce();
  });

  it("reports incomplete duplication without claiming success or automatically retrying it", async () => {
    const pending = deferred<BookList>(); state.duplicateList.mockReturnValueOnce(pending.promise);
    render(view()); await menuAction("Duplicate");
    expect(screen.getByRole("button", { name: "Actions for Weekend" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create List" })).toBeDisabled();
    await act(async () => pending.reject(new Error("Second book failed")));
    expect(screen.getByRole("alert")).toHaveTextContent("A partial copy may already be in your lists");
    expect(state.toast).not.toHaveBeenCalled(); expect(state.duplicateList).toHaveBeenCalledOnce();
    await menuAction("Duplicate");
    await waitFor(() => expect(state.toast).toHaveBeenCalledOnce());
    expect(state.duplicateList).toHaveBeenCalledTimes(2);
  });

  it.each(["create", "edit", "delete", "duplicate"])("ignores late %s feedback after account replacement", async mode => {
    const pending = deferred<BookList | void>();
    const method = mode === "create" ? state.createList : mode === "edit" ? state.updateList : mode === "delete" ? state.deleteList : state.duplicateList;
    method.mockReturnValueOnce(pending.promise);
    const rendered = render(view());
    if (mode === "create") openCreate(); else await menuAction(mode === "edit" ? "Edit" : mode === "delete" ? "Delete" : "Duplicate");
    if (mode === "create" || mode === "edit") { draft(); fireEvent.submit(screen.getByLabelText("Name").closest("form")!); }
    if (mode === "delete") fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    rendered.rerender(view("other"));
    await act(async () => pending.resolve({ ...list, id: "copy", name: "Copy" }));
    expect(state.toast).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openCreate(); expect(screen.getByLabelText("Name")).toHaveValue("");
  });
});

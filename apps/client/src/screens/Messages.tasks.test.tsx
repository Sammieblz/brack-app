import { StrictMode, useLayoutEffect, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageThreadTaskState } from "@/components/messaging/MessageThread";

const mocks = vi.hoisted(() => ({
  user: { id: "reader" } as { id: string } | null, authLoading: false, width: 1000, rem: 16,
  measure: () => {}, confirm: vi.fn(), start: vi.fn(), refresh: vi.fn(), guard: vi.fn(),
  task: { pending: false, hasTransientDraft: false },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }) }));
vi.mock("@/hooks/useUIEnvironment", () => ({ useUIEnvironmentValue: (select: (value: { windowClass: string }) => unknown) => select({ windowClass: "expanded" }) }));
vi.mock("@/hooks/useConversations", () => ({ useConversations: () => ({ conversations: [{ id: "one", other_user: { display_name: "Reader One" } }, { id: "two", other_user: { display_name: "Reader Two" } }], loading: false, hasLoaded: true, error: null, getOrCreateConversation: mocks.start, refetchConversations: mocks.refresh }) }));
vi.mock("@/hooks/useMessages", () => ({ useMessages: () => ({ messages: [], detail: null, loading: false, hasLoaded: true, error: null, refetchMessages: vi.fn(), sendMessage: vi.fn(), toggleReaction: vi.fn(), deleteMessage: vi.fn() }) }));
vi.mock("@/contexts/ConfirmDialogContext", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("@/hooks/useAppBackGuard", () => ({ useAppBackGuard: (enabled: boolean, check: () => unknown) => mocks.guard(enabled, check) }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/NativeHeader", () => ({ NativeHeader: ({ title, back }: { title: string; back?: { onBack: () => unknown } }) => <header><h1>{title}</h1>{back && <button onClick={() => void back.onBack()}>Back to messages</button>}</header> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: ({ title }: { title: string }) => <p>{title}</p> }));
vi.mock("@/components/messaging/ConversationsList", () => ({ ConversationsList: ({ onSelectConversation }: { onSelectConversation: (id: string) => void }) => <>{["one", "two"].map(id => <button key={id} data-conversation-id={id} onClick={() => onSelectConversation(id)}>Open {id}</button>)}</> }));
// This suite verifies parent ownership only. Real thread/file/reply behavior is
// covered by MessageThread units and the actual-consumer browser fixture.
vi.mock("@/components/messaging/MessageThread", () => ({ MessageThread: ({ conversationId, onTaskStateChange }: { conversationId: string; onTaskStateChange: (state: MessageThreadTaskState) => void }) => {
  const [draft, setDraft] = useState("");
  useLayoutEffect(() => { onTaskStateChange(mocks.task); });
  return <input aria-label={`Draft ${conversationId}`} value={draft} onChange={event => setDraft(event.target.value)} />;
} }));
import Messages from "./Messages";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const view = (state?: Record<string, unknown>) => <MemoryRouter initialEntries={[{ pathname: "/messages", state }]}><Messages /></MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks(); mocks.user = { id: "reader" }; mocks.authLoading = false;
  mocks.width = 1000; mocks.rem = 16; mocks.task = { pending: false, hasTransientDraft: false };
  mocks.confirm.mockResolvedValue(false); mocks.start.mockResolvedValue("created");
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { mocks.measure = callback; } observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, this.hasAttribute("data-messages-layout") ? mocks.width : this.classList.contains("w-[1rem]") ? mocks.rem : 0, 600);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Messages parent task ownership", () => {
  it("keeps the same task, caret and draft through content fit and live text-scale changes", async () => {
    render(view({ conversationId: "one" }));
    const field = await screen.findByRole("textbox", { name: "Draft one" });
    fireEvent.change(field, { target: { value: "A retained thought" } }); field.focus();
    (field as HTMLInputElement).setSelectionRange(3, 7);
    for (const [width, rem] of [[390, 16], [767, 16], [768, 16], [834, 16], [1280, 16], [1280, 32], [390, 16]]) {
      act(() => { mocks.width = width; mocks.rem = rem; mocks.measure(); });
      expect(screen.getByRole("textbox", { name: "Draft one" })).toBe(field);
      expect(field).toHaveValue("A retained thought"); expect(field).toHaveFocus();
      expect((field as HTMLInputElement).selectionStart).toBe(3);
    }
  });

  it("keeps transient work on refused departure then changes once after accepted discard", async () => {
    mocks.task.hasTransientDraft = true;
    render(view({ conversationId: "one" }));
    const field = await screen.findByRole("textbox", { name: "Draft one" });
    fireEvent.click(screen.getByRole("button", { name: "Open two" }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(field).toBeInTheDocument();
    mocks.confirm.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Open two" }));
    expect(await screen.findByRole("textbox", { name: "Draft two" })).toBeInTheDocument();
  });

  it("refuses both row switches and contextual Back while the thread is pending", async () => {
    mocks.task.pending = true;
    render(view({ conversationId: "one" }));
    const field = await screen.findByRole("textbox", { name: "Draft one" });
    fireEvent.click(screen.getByRole("button", { name: "Open two" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to messages" }));
    await act(async () => {});
    expect(field).toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.guard).toHaveBeenLastCalledWith(true, expect.any(Function));
  });

  it("returns from the single thread to its surviving inbox control", async () => {
    mocks.width = 390;
    render(view({ conversationId: "one" }));
    await screen.findByRole("textbox", { name: "Draft one" });
    fireEvent.click(screen.getByRole("button", { name: "Back to messages" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open one" })).toHaveFocus());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shares a StrictMode entry request and does not let its late result replace an explicit selection", async () => {
    const request = deferred<string | null>(); mocks.start.mockReturnValue(request.promise);
    render(<StrictMode>{view({ startConversationWith: "incoming-reader" })}</StrictMode>);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open two" }));
    const field = await screen.findByRole("textbox", { name: "Draft two" });
    await act(async () => request.resolve("created"));
    expect(field).toBeInTheDocument(); expect(screen.queryByRole("textbox", { name: "Draft created" })).not.toBeInTheDocument();
  });

  it("offers a real entry retry without recreating an existing conversation ID", async () => {
    mocks.start.mockResolvedValueOnce(null).mockResolvedValueOnce("created");
    render(view({ startConversationWith: "incoming-reader" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't open");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("textbox", { name: "Draft created" })).toBeInTheDocument();
    expect(mocks.start).toHaveBeenCalledTimes(2);
  });

  it("withdraws the old task during auth loading and ignores its unresolved discard", async () => {
    const answer = deferred<boolean>(); mocks.confirm.mockReturnValue(answer.promise); mocks.task.hasTransientDraft = true;
    const { rerender } = render(view());
    // No current thread means no transient draft has been reported yet.
    fireEvent.click(screen.getByRole("button", { name: "Open one" }));
    await screen.findByRole("textbox", { name: "Draft one" });
    fireEvent.click(screen.getByRole("button", { name: "Open two" }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    mocks.authLoading = true; rerender(view());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => answer.resolve(true));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

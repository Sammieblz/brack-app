import { act, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNavigationContext, type AppNavigation } from "@/contexts/appNavigation";
import { registerBackLayer } from "@/lib/backLayers";
import type { Conversation } from "@/hooks/useConversations";
import { ConversationsList } from "./ConversationsList";

const mocks = vi.hoisted(() => ({ read: vi.fn(), mute: vi.fn(), hide: vi.fn(), success: vi.fn(), haptic: vi.fn() }));
vi.mock("@/services/api", () => ({ markConversationRead: mocks.read, updateConversationSettings: mocks.mute, deleteConversation: mocks.hide }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/utils/hapticToast", () => ({ hapticToast: { success: mocks.success } }));
vi.mock("@/components/empty/EmptyMessages", () => ({ EmptyMessages: () => <p>No conversations</p> }));

const conversation = (id = "conversation-a", name = "Ada Reader"): Conversation => ({
  id, participant_one_id: "reader", participant_two_id: `other-${id}`,
  created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z",
  other_user: { id: `other-${id}`, display_name: name }, unread_count: 2,
  last_message: { id: `message-${id}`, sender_id: `other-${id}`, content: "What are you reading?", message_type: "text", created_at: "2026-09-30T10:00:00Z" },
  settings: { conversation_id: id, user_id: "reader", is_muted: false, is_pinned: false, is_archived: false },
});
const first = conversation();
const second = conversation("conversation-b", "Grace Reader");
const deferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};
const Location = () => <output aria-label="Current route">{useLocation().pathname}</output>;
const setup = (values: Conversation[] = [first, second], onBeforeLeave?: () => Promise<boolean>) => {
  const select = vi.fn();
  const body = (conversations = values, currentUserId = "reader") => <MemoryRouter>
    <ConversationsList conversations={conversations} currentUserId={currentUserId} selectedConversationId={first.id} onSelectConversation={select} onBeforeLeave={onBeforeLeave} />
    <Location />
  </MemoryRouter>;
  const result = render(body());
  return { ...result, select, update: (conversations: Conversation[], currentUserId = "reader") => result.rerender(body(conversations, currentUserId)) };
};
const primary = () => screen.getByRole("button", { name: "Open conversation with Ada Reader" });
const trigger = () => screen.getByRole("button", { name: "Actions for conversation with Ada Reader" });
const actions = () => screen.queryByRole("group", { name: "Conversation actions for Ada Reader" });
const reveal = () => fireEvent.click(trigger());
const start = (target: HTMLElement, x = 250, y = 80) => {
  fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 1 });
  fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: x, clientY: y }] });
};
const move = (target: HTMLElement, x: number, y = 80) => {
  const event = createEvent.touchMove(target, { touches: [{ identifier: 1, clientX: x, clientY: y }], cancelable: true });
  fireEvent(target, event);
  return event;
};
const end = (target: HTMLElement) => fireEvent.touchEnd(target, { touches: [] });
const swipe = (target = primary(), x = 100) => { start(target); move(target, x); end(target); };

describe("Conversation list accessible actions and outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue(undefined);
    mocks.mute.mockResolvedValue(undefined);
    mocks.hide.mockResolvedValue(undefined);
    window.getSelection()?.removeAllRanges();
  });

  it("opens the conversation with keyboard and keeps profile navigation independent", async () => {
    const user = userEvent.setup();
    const { select } = setup();
    primary().focus();
    await user.keyboard("{Enter} ");
    expect(select).toHaveBeenCalledTimes(2);
    expect(primary()).toHaveAttribute("data-conversation-id", first.id);
    expect(primary()).toHaveAccessibleDescription(/What are you reading\?.*2 unread messages/);
    await user.click(screen.getByRole("button", { name: "Open Ada Reader profile" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(`/users/other-${first.id}`);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("provides all row actions from a visible keyboard control", async () => {
    const user = userEvent.setup();
    setup();
    expect(actions()).not.toBeInTheDocument();
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(within(actions()!).getByRole("button", { name: "Mark as read" })).toBeEnabled();
    expect(within(actions()!).getByRole("button", { name: "Mute" })).toBeEnabled();
    expect(within(actions()!).getByRole("button", { name: "Hide conversation" })).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(actions()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("preserves a guarded thread on Keep and navigates to the profile only after Leave", async () => {
    const beforeLeave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    setup([first, second], beforeLeave);
    const profile = screen.getByRole("button", { name: "Open Ada Reader profile" });
    fireEvent.click(profile);
    await waitFor(() => expect(profile).toBeEnabled());
    expect(screen.getByLabelText("Current route")).toHaveTextContent(/^\/$/);
    fireEvent.click(profile);
    await waitFor(() => expect(screen.getByLabelText("Current route")).toHaveTextContent(`/users/other-${first.id}`));
    expect(beforeLeave).toHaveBeenCalledTimes(2);
  });

  it("deduplicates profile departure and respects a parent's pending refusal", async () => {
    const task = deferred();
    const beforeLeave = vi.fn(() => task.promise.then(Boolean));
    setup([first], beforeLeave);
    const profile = screen.getByRole("button", { name: "Open Ada Reader profile" });
    fireEvent.click(profile); fireEvent.click(profile);
    expect(profile).toBeDisabled();
    expect(beforeLeave).toHaveBeenCalledOnce();
    await act(async () => task.resolve(false));
    expect(profile).toBeEnabled();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(/^\/$/);
  });

  it.each(["account", "row removal"])("does not follow a stale approved profile departure after %s", async (reason) => {
    const task = deferred();
    const view = setup([first, second], () => task.promise.then(Boolean));
    fireEvent.click(screen.getByRole("button", { name: "Open Ada Reader profile" }));
    if (reason === "account") view.update([first, second], "new-reader");
    else view.update([second]);
    await act(async () => task.resolve(true));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(/^\/$/);
  });

  it("serializes pending writes, rejects pending departure, and keeps errors for explicit retry", async () => {
    const task = deferred();
    mocks.mute.mockReturnValueOnce(task.promise);
    let guard: (() => boolean | Promise<boolean>) | undefined;
    const unregister = vi.fn();
    const navigation: AppNavigation = {
      routeKey: "messages", canGoBack: true, requestBack: vi.fn(), registerControl: vi.fn(() => () => {}),
      registerGuard: vi.fn((check) => { guard = check; return unregister; }),
    };
    render(<MemoryRouter><AppNavigationContext.Provider value={navigation}><ConversationsList conversations={[first]} currentUserId="reader" selectedConversationId={null} onSelectConversation={vi.fn()} /></AppNavigationContext.Provider></MemoryRouter>);
    reveal();
    const mute = screen.getByRole("button", { name: "Mute" });
    fireEvent.click(mute);
    fireEvent.click(mute);
    expect(mocks.mute).toHaveBeenCalledExactlyOnceWith(first.id, { is_muted: true });
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
    expect(primary()).toBeDisabled();
    expect(trigger()).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Search messages" })).toBeDisabled();
    expect(guard?.()).toBe(false);
    await act(async () => task.reject(new Error("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not change notifications. Try again.");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unmute" })).toBeEnabled());
    expect(mocks.mute).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps confirmed mute state through stale refresh then permits a genuine later update", async () => {
    const { update } = setup();
    reveal();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unmute" })).toBeEnabled());
    update([{ ...first }, second]);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(mocks.mute).toHaveBeenLastCalledWith(first.id, { is_muted: false }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mute" })).toBeEnabled());
    update([{ ...first }, second]);
    update([{ ...first, settings: { ...first.settings!, is_muted: true } }, second]);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeEnabled();
  });

  it("marks the current unread message once without masking a new unread message", async () => {
    const { update } = setup();
    reveal();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark as read" })).toBeDisabled());
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(first.id);
    update([{ ...first }, second]);
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeDisabled();
    update([{ ...first, last_message: { ...first.last_message!, id: "new-message" }, unread_count: 1 }, second]);
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeEnabled();
  });

  it("keeps a failed hide visible, retries once, and focuses search after confirmed removal", async () => {
    mocks.hide.mockRejectedValueOnce(new Error("offline"));
    const { update } = setup();
    reveal();
    fireEvent.click(screen.getByRole("button", { name: "Hide conversation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not hide this conversation. Try again.");
    expect(primary()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide conversation" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open conversation with Ada Reader" })).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Search messages" })).toHaveFocus();
    expect(mocks.hide).toHaveBeenCalledTimes(2);
    update([{ ...first }, second]);
    expect(screen.queryByRole("button", { name: "Open conversation with Ada Reader" })).not.toBeInTheDocument();
    update([second]);
    update([first, second]);
    expect(primary()).toBeInTheDocument();
  });

  it.each(["account", "unmount"])("does not publish obsolete outcomes after %s abandonment", async (kind) => {
    const task = deferred();
    mocks.mute.mockReturnValueOnce(task.promise);
    const changed = vi.fn();
    window.addEventListener("messages-changed", changed);
    const view = setup();
    reveal();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    if (kind === "account") view.update([first, second], "new-reader");
    else view.unmount();
    await act(async () => task.resolve());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    if (kind === "account") { reveal(); expect(screen.getByRole("button", { name: "Mute" })).toBeEnabled(); }
    window.removeEventListener("messages-changed", changed);
  });

  it("retains the real input and row across refresh and filters by reader name", () => {
    const { update } = setup();
    const input = screen.getByRole("textbox", { name: "Search messages" });
    const row = primary();
    reveal();
    fireEvent.change(input, { target: { value: "Ada" } });
    update([{ ...first }, { ...second }]);
    expect(primary()).toBe(row);
    expect(screen.getByRole("textbox", { name: "Search messages" })).toBe(input);
    expect(input).toHaveValue("Ada");
    expect(actions()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open conversation with Grace Reader" })).not.toBeInTheDocument();
  });
});

describe("Conversation row contact arbitration", () => {
  beforeEach(() => { vi.clearAllMocks(); window.getSelection()?.removeAllRanges(); });

  it("reveals with a local left swipe, closes with right swipe, and does not also open the thread", () => {
    const { select } = setup();
    const open = primary();
    start(open);
    expect(move(open, 100).defaultPrevented).toBe(true);
    end(open);
    expect(actions()).toBeInTheDocument();
    fireEvent.click(open, { detail: 1 });
    expect(select).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Mute" }).focus();
    swipe(open, 390);
    expect(actions()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("keeps short and vertical contacts native and restores independent tap/keyboard action", async () => {
    const { select } = setup();
    const open = primary();
    start(open);
    expect(move(open, 246, 140).defaultPrevented).toBe(false);
    expect(move(open, 100, 150).defaultPrevented).toBe(false);
    end(open);
    fireEvent.click(open, { detail: 1 });
    expect(actions()).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    swipe(open, 220);
    expect(actions()).not.toBeInTheDocument();
    fireEvent.click(open, { detail: 1 });
    expect(select).not.toHaveBeenCalled();
    open.focus();
    await userEvent.setup().keyboard("{Enter} ");
    expect(select).toHaveBeenCalledTimes(2);
    start(open); end(open); fireEvent.click(open, { detail: 1 });
    expect(select).toHaveBeenCalledTimes(3);
  });

  it.each([2, 24, window.innerWidth - 2, window.innerWidth - 24])("never claims the system edge at %s", (x) => {
    const { select } = setup();
    start(primary(), x);
    expect(move(primary(), x - 120).defaultPrevented).toBe(false);
    end(primary());
    fireEvent.click(primary(), { detail: 1 });
    expect(actions()).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it.each(["Open Ada Reader profile", "Actions for conversation with Ada Reader"])("leaves native control %s independent", (name) => {
    setup();
    const target = screen.getByRole("button", { name });
    start(target);
    expect(move(target, 100).defaultPrevented).toBe(false);
    end(target);
    expect(actions()).not.toBeInTheDocument();
  });

  it.each(["scroll", "blur", "pagehide", "contextmenu"])("cancels an active contact on %s", (type) => {
    const { select } = setup();
    start(primary()); move(primary(), 100);
    fireEvent(window, new Event(type));
    expect(move(primary(), 90).defaultPrevented).toBe(false);
    end(primary());
    fireEvent.click(primary(), { detail: 1 });
    expect(actions()).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it.each(["second contact", "replacement contact", "touchcancel", "hidden page"])("cancels for %s", (reason) => {
    setup();
    start(primary()); move(primary(), 100);
    let hidden: ReturnType<typeof vi.spyOn> | undefined;
    if (reason === "second contact") fireEvent.touchStart(document.body, { touches: [{ identifier: 1, clientX: 100, clientY: 80 }, { identifier: 2, clientX: 200, clientY: 80 }] });
    if (reason === "replacement contact") fireEvent.touchMove(primary(), { touches: [{ identifier: 2, clientX: 80, clientY: 80 }] });
    if (reason === "touchcancel") fireEvent.touchCancel(primary(), { touches: [] });
    if (reason === "hidden page") { hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true); fireEvent(document, new Event("visibilitychange")); }
    end(primary());
    expect(actions()).not.toBeInTheDocument();
    expect(mocks.haptic).not.toHaveBeenCalled();
    hidden?.mockRestore();
  });

  it.each(["before start", "during contact"])("protects selected text %s", (timing) => {
    const { select } = setup();
    const selection = window.getSelection()!;
    const range = document.createRange(); range.selectNodeContents(primary());
    if (timing === "before start") selection.addRange(range);
    start(primary()); move(primary(), 100);
    if (timing === "during contact") { selection.addRange(range); fireEvent(document, new Event("selectionchange")); }
    end(primary()); fireEvent.click(primary(), { detail: 1 });
    expect(actions()).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    selection.removeAllRanges();
  });

  it.each(["before start", "before release"])("yields to a registered overlay opened %s", (timing) => {
    setup();
    const overlay = document.createElement("div"); overlay.dataset.state = "open";
    let unregister: (() => void) | undefined;
    const register = () => { document.body.append(overlay); unregister = registerBackLayer(overlay); };
    try {
      if (timing === "before start") register();
      start(primary()); move(primary(), 100);
      if (timing === "before release") register();
      end(primary());
      expect(actions()).not.toBeInTheDocument();
      expect(overlay.dataset.state).toBe("open");
      expect(mocks.haptic).not.toHaveBeenCalled();
    } finally { unregister?.(); overlay.remove(); }
  });

  it("attaches observers only to eligible active contacts and removes them after unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = setup();
    expect(add.mock.calls.filter(([type]) => type === "touchstart")).toHaveLength(0);
    start(primary());
    const listener = add.mock.calls.find(([type]) => type === "touchstart")![1];
    end(primary());
    expect(remove).toHaveBeenCalledWith("touchstart", listener, true);
    start(primary());
    const next = add.mock.calls.filter(([type]) => type === "touchstart")[1][1];
    unmount();
    expect(remove).toHaveBeenCalledWith("touchstart", next, true);
    add.mockRestore(); remove.mockRestore();
  });
});

vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({
  user: { id: "reader-1" },
  getPostsFeed: vi.fn(),
  getSocialFeed: vi.fn(),
  fetchUserProfileWithStats: vi.fn(),
  fetchConversations: vi.fn(),
  fetchConversationDetail: vi.fn(),
  sendMessage: vi.fn(),
  toggleMessageReaction: vi.fn(),
  deleteMessage: vi.fn(),
  markConversationRead: vi.fn(),
  subscribeToMessages: vi.fn(() => vi.fn()),
  subscribeToConversationChanges: vi.fn(() => vi.fn()),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/services/api", () => ({
  getPostsFeed: mocks.getPostsFeed,
  getSocialFeed: mocks.getSocialFeed,
  fetchUserProfileWithStats: mocks.fetchUserProfileWithStats,
  togglePostLike: vi.fn(),
  fetchConversations: mocks.fetchConversations,
  getOrCreateConversation: vi.fn(),
  subscribeToConversationChanges: mocks.subscribeToConversationChanges,
  fetchConversationDetail: mocks.fetchConversationDetail,
  markConversationRead: mocks.markConversationRead,
  subscribeToMessages: mocks.subscribeToMessages,
  sendMessage: mocks.sendMessage,
  toggleMessageReaction: mocks.toggleMessageReaction,
  deleteMessage: mocks.deleteMessage,
}));

import { usePosts } from "./usePosts";
import { useConversations } from "./useConversations";
import { useMessages } from "./useMessages";
import { useUserProfile } from "./useUserProfile";
import { useSocialFeed } from "./useSocialFeed";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const feedResponse = { items: [], next_cursor: null, has_more: false, caught_up: true, feed_mode: "following" };
const conversation = (id: string, messages: { id: string }[] = []) => ({ conversation: { id }, messages, is_blocked: false });
const profileResponse = (id: string) => ({ profile: { id }, stats: { totalBooks: 7, booksRead: 3, currentlyReading: 1, badges: 2 }, gamification: { level: 5 } });

describe("social request lifecycles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "reader-1" };
    mocks.markConversationRead.mockResolvedValue(undefined);
  });

  it("distinguishes initial load from refresh of a successfully empty feed", async () => {
    mocks.getPostsFeed.mockResolvedValueOnce(feedResponse);
    const { result } = renderHook(() => usePosts());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<typeof feedResponse>();
    mocks.getPostsFeed.mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetchPosts(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.posts).toEqual([]);
    await act(async () => { pending.resolve(feedResponse); await refresh; });
    expect(result.current.loading).toBe(false);
  });

  it("clears a previous reader's feed before the next reader's request resolves", async () => {
    mocks.getPostsFeed.mockResolvedValueOnce({ ...feedResponse, items: [{ id: "private-post" }] });
    const { result, rerender } = renderHook(() => usePosts());
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    const pending = deferred<typeof feedResponse>();
    mocks.getPostsFeed.mockReturnValueOnce(pending.promise);
    mocks.user = { id: "reader-2" };
    rerender();
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.posts).toEqual([]);
    await act(async () => { pending.resolve(feedResponse); });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  });

  it("retains an empty inbox and stable navigation callback during refresh", async () => {
    mocks.fetchConversations.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const startConversation = result.current.getOrCreateConversation;
    const pending = deferred<never[]>();
    mocks.fetchConversations.mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetchConversations(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.getOrCreateConversation).toBe(startConversation);
    await act(async () => { pending.resolve([]); await refresh; });
  });

  it("ignores a late response from the previous conversation", async () => {
    const first = deferred<ReturnType<typeof conversation>>();
    const second = deferred<ReturnType<typeof conversation>>();
    mocks.fetchConversationDetail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ id }) => useMessages(id), { initialProps: { id: "thread-a" } });
    rerender({ id: "thread-b" });
    await act(async () => { first.resolve(conversation("thread-a", [{ id: "old-message" }])); });
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(mocks.markConversationRead).not.toHaveBeenCalled();
    await act(async () => { second.resolve(conversation("thread-b", [{ id: "new-message" }])); });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.messages[0].id).toBe("new-message");
  });

  it("retains a loaded empty thread during realtime refresh", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a"));
    const { result } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<ReturnType<typeof conversation>>();
    mocks.fetchConversationDetail.mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetchMessages(); });
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.loading).toBe(true);
    expect(result.current.detail?.conversation.id).toBe("thread-a");
    await act(async () => { pending.resolve(conversation("thread-a")); await refresh; });
  });

  it("discards retained private messages when refreshed access is forbidden", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "private-message" }]));
    const { result } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.fetchConversationDetail.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { await result.current.refetchMessages(); });
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.detail).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    log.mockRestore();
  });

  it("does not duplicate a committed message when refresh precedes an idempotent retry", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "earlier" }]));
    const { result } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const request = { content: "A single message", client_message_id: "attempt-a" };
    const committed = { id: "committed", content: "A single message", current_user_reaction: null };
    const refreshed = { ...committed, current_user_reaction: "heart" };
    mocks.sendMessage.mockRejectedValueOnce(new Error("Response interrupted after commit")).mockResolvedValueOnce(committed);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => { expect(await result.current.sendMessage(request)).toBe(false); });
      mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "earlier" }, refreshed, { id: "later" }]));
      await act(async () => { await result.current.refetchMessages(); });
      await act(async () => { expect(await result.current.sendMessage(request)).toBe(true); });
      expect(mocks.sendMessage.mock.calls[0][0]).toEqual(mocks.sendMessage.mock.calls[1][0]);
      expect(mocks.sendMessage.mock.calls[1][0]).toMatchObject({ conversation_id: "thread-a", client_message_id: "attempt-a" });
      expect(result.current.messages.map((message) => message.id)).toEqual(["earlier", "committed", "later"]);
      expect(result.current.messages[1]).toBe(refreshed);
    } finally {
      log.mockRestore();
    }
  });

  it("does not append another row when refresh wins the race with the original send response", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a"));
    const { result } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const committed = { id: "committed", content: "Already received through refresh" };
    const pending = deferred<typeof committed>();
    mocks.sendMessage.mockReturnValueOnce(pending.promise);
    let send!: Promise<boolean>;
    act(() => { send = result.current.sendMessage({ content: committed.content, client_message_id: "attempt-a" }); });
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [committed]));
    await act(async () => { await result.current.refetchMessages(); });
    await act(async () => { pending.resolve(committed); expect(await send).toBe(true); });
    expect(result.current.messages).toEqual([committed]);
  });

  it.each([
    ["account", "success"], ["account", "failure"],
    ["unmount", "success"], ["unmount", "failure"],
  ])("suppresses obsolete send effects after %s on late %s", async (change, outcome) => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a"));
    const { result, rerender, unmount } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<{ id: string }>();
    mocks.sendMessage.mockReturnValueOnce(pending.promise);
    let send!: Promise<boolean>;
    act(() => { send = result.current.sendMessage({ content: "Old owner's request", client_message_id: "attempt-old" }); });
    if (change === "account") {
      mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "new-owner-message" }]));
      mocks.user = { id: "reader-2" };
      rerender();
      await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    } else {
      unmount();
    }
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        if (outcome === "success") pending.resolve({ id: "old-owner-message" });
        else pending.reject(new Error("Old owner's send failed"));
        expect(await send).toBe(outcome === "success");
      });
      expect(toast.error).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(dispatch.mock.calls.some(([event]) => event.type === "messages-changed")).toBe(false);
      if (change === "account") expect(result.current.messages.map((message) => message.id)).toEqual(["new-owner-message"]);
    } finally {
      dispatch.mockRestore();
      log.mockRestore();
    }
  });

  it.each([
    ["reaction", "account", "success"], ["reaction", "account", "failure"],
    ["reaction", "unmount", "success"], ["reaction", "unmount", "failure"],
    ["delete", "account", "success"], ["delete", "account", "failure"],
    ["delete", "unmount", "success"], ["delete", "unmount", "failure"],
  ])("suppresses obsolete %s feedback after %s on late %s", async (action, change, outcome) => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "target" }]));
    const { result, rerender, unmount } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<{ message: { id: string; current_user_reaction: string } }>();
    const api = action === "reaction" ? mocks.toggleMessageReaction : mocks.deleteMessage;
    api.mockReturnValueOnce(pending.promise);
    let mutation!: Promise<boolean>;
    act(() => { mutation = action === "reaction" ? result.current.toggleReaction("target", "heart") : result.current.deleteMessage("target"); });
    if (change === "account") {
      mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "new-owner-message" }]));
      mocks.user = { id: "reader-2" };
      rerender();
      await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    } else unmount();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        if (outcome === "success") pending.resolve({ message: { id: "target", current_user_reaction: "heart" } });
        else pending.reject(new Error("Old owner's action failed"));
        expect(await mutation).toBe(outcome === "success");
      });
      expect(toast.error).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(dispatch.mock.calls.some(([event]) => event.type === "messages-changed")).toBe(false);
      if (change === "account") expect(result.current.messages.map(message => message.id)).toEqual(["new-owner-message"]);
    } finally { dispatch.mockRestore(); log.mockRestore(); }
  });

  it.each([
    ["reaction", "success"], ["reaction", "failure"], ["delete", "success"], ["delete", "failure"],
  ])("preserves current-owner %s %s outcomes", async (action, outcome) => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "target" }]));
    const { result } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const api = action === "reaction" ? mocks.toggleMessageReaction : mocks.deleteMessage;
    if (outcome === "success") api.mockResolvedValueOnce({ message: { id: "target", current_user_reaction: "heart" } });
    else api.mockRejectedValueOnce(new Error("Current action failed"));
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        const resultValue = action === "reaction" ? await result.current.toggleReaction("target", "heart") : await result.current.deleteMessage("target");
        expect(resultValue).toBe(outcome === "success");
      });
      if (outcome === "failure") {
        expect(toast.error).toHaveBeenCalledWith(action === "reaction" ? "Failed to update reaction" : "Failed to delete message");
        expect(result.current.messages).toEqual([{ id: "target" }]);
        expect(dispatch.mock.calls.some(([event]) => event.type === "messages-changed")).toBe(false);
      } else {
        expect(toast.error).not.toHaveBeenCalled();
        if (action === "reaction") expect(result.current.messages[0].current_user_reaction).toBe("heart");
        else {
          expect(result.current.messages[0].deleted_at).toEqual(expect.any(String));
          expect(dispatch.mock.calls.some(([event]) => event.type === "messages-changed")).toBe(true);
        }
      }
    } finally { dispatch.mockRestore(); log.mockRestore(); }
  });

  it("does not revive an old deletion after leaving and reopening the same conversation", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "target" }]));
    const { result, rerender } = renderHook(({ id }) => useMessages(id), { initialProps: { id: "thread-a" } });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<void>();
    mocks.deleteMessage.mockReturnValueOnce(pending.promise);
    let mutation!: Promise<boolean>;
    act(() => { mutation = result.current.deleteMessage("target"); });
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-b"));
    rerender({ id: "thread-b" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "target" }]));
    rerender({ id: "thread-a" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const dispatch = vi.spyOn(window, "dispatchEvent");
    try {
      await act(async () => { pending.resolve(); expect(await mutation).toBe(true); });
      expect(result.current.messages).toEqual([{ id: "target" }]);
      expect(dispatch.mock.calls.some(([event]) => event.type === "messages-changed")).toBe(false);
    } finally { dispatch.mockRestore(); }
  });

  it("never reveals the previous profile after a new target returns a transient error", async () => {
    mocks.fetchUserProfileWithStats.mockResolvedValueOnce(profileResponse("profile-a"));
    const { result, rerender } = renderHook(({ id }) => useUserProfile(id), { initialProps: { id: "profile-a" } });
    await waitFor(() => expect(result.current.profile?.id).toBe("profile-a"));
    const pending = deferred<ReturnType<typeof profileResponse>>();
    mocks.fetchUserProfileWithStats.mockReturnValueOnce(pending.promise);
    rerender({ id: "profile-b" });
    expect(result.current.profile).toBeNull();
    expect(result.current.gamification).toBeNull();
    expect(result.current.stats.totalBooks).toBe(0);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { pending.reject(Object.assign(new Error("Unavailable"), { status: 503 })); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.profile).toBeNull();
    expect(result.current.gamification).toBeNull();
    expect(result.current.stats.totalBooks).toBe(0);
    log.mockRestore();
  });

  it("masks and refetches the same profile when the viewer changes", async () => {
    mocks.fetchUserProfileWithStats.mockResolvedValueOnce(profileResponse("profile-a"));
    const { result, rerender } = renderHook(() => useUserProfile("profile-a"));
    await waitFor(() => expect(result.current.profile?.id).toBe("profile-a"));
    const pending = deferred<ReturnType<typeof profileResponse>>();
    mocks.fetchUserProfileWithStats.mockReturnValueOnce(pending.promise);
    mocks.user = { id: "reader-2" };
    rerender();
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(mocks.fetchUserProfileWithStats).toHaveBeenCalledTimes(2);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { pending.reject(Object.assign(new Error("Unavailable"), { status: 503 })); });
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
    log.mockRestore();
  });

  it("preserves only the same viewer's same profile on transient refresh failure", async () => {
    mocks.fetchUserProfileWithStats.mockResolvedValueOnce(profileResponse("profile-a"));
    const { result } = renderHook(() => useUserProfile("profile-a"));
    await waitFor(() => expect(result.current.profile?.id).toBe("profile-a"));
    mocks.fetchUserProfileWithStats.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.profile?.id).toBe("profile-a");
    expect(result.current.stats.totalBooks).toBe(7);
    log.mockRestore();
  });

  it("masks the same conversation and ignores the previous viewer's late refresh", async () => {
    mocks.fetchConversationDetail.mockResolvedValueOnce(conversation("thread-a", [{ id: "private-a" }]));
    const { result, rerender } = renderHook(() => useMessages("thread-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const oldRefresh = deferred<ReturnType<typeof conversation>>();
    const newRead = deferred<ReturnType<typeof conversation>>();
    mocks.fetchConversationDetail.mockReturnValueOnce(oldRefresh.promise).mockReturnValueOnce(newRead.promise);
    act(() => { void result.current.refetchMessages(); });
    mocks.markConversationRead.mockClear();
    mocks.user = { id: "reader-2" };
    rerender();
    expect(result.current.messages).toEqual([]);
    expect(result.current.detail).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.hasLoaded).toBe(false);
    await act(async () => { oldRefresh.resolve(conversation("thread-a", [{ id: "private-late-a" }])); });
    expect(result.current.messages).toEqual([]);
    expect(mocks.markConversationRead).not.toHaveBeenCalled();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { newRead.reject(Object.assign(new Error("Unavailable"), { status: 503 })); });
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.detail).toBeNull();
    log.mockRestore();
  });

  it.each(["posts", "activity"])("does not paginate %s while the first page is refreshing", async (mode) => {
    const api = mode === "posts" ? mocks.getPostsFeed : mocks.getSocialFeed;
    const response = { ...feedResponse, activities: [], has_more: true, next_cursor: "next-page" };
    api.mockResolvedValueOnce(response);
    const useFeed = mode === "posts" ? usePosts : useSocialFeed;
    const { result } = renderHook(() => useFeed());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<typeof response>();
    api.mockReturnValueOnce(pending.promise);
    act(() => { void ("refetchPosts" in result.current ? result.current.refetchPosts() : result.current.refetchFeed()); });
    expect(result.current.loading).toBe(true);
    act(() => result.current.loadMore());
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(response); });
  });

  it.each(["posts", "activity"])("retries the failed %s cursor without replacing retained pages", async (mode) => {
    const api = mode === "posts" ? mocks.getPostsFeed : mocks.getSocialFeed;
    const response = { ...feedResponse, items: [{ id: "first-page" }], activities: [{ id: "first-page" }], has_more: true, next_cursor: "next-page" };
    api.mockResolvedValueOnce(response);
    const useFeed = mode === "posts" ? usePosts : useSocialFeed;
    const { result } = renderHook(() => useFeed());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    api.mockRejectedValueOnce(new Error("Unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    api.mockResolvedValueOnce({ ...response, items: [{ id: "second-page" }], activities: [{ id: "second-page" }], has_more: false, next_cursor: null });
    await act(async () => { await result.current.retryLastRequest(); });
    expect(api).toHaveBeenLastCalledWith(...(mode === "posts" ? ["next-page", 20] : [20, "next-page"]));
    expect(("posts" in result.current ? result.current.posts : result.current.activities).map(item => item.id)).toEqual(["first-page", "second-page"]);
    log.mockRestore();
  });
});

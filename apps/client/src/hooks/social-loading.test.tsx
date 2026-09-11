vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "reader-1" },
  getPostsFeed: vi.fn(),
  getSocialFeed: vi.fn(),
  fetchUserProfileWithStats: vi.fn(),
  fetchConversations: vi.fn(),
  fetchConversationDetail: vi.fn(),
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
  sendMessage: vi.fn(),
  toggleMessageReaction: vi.fn(),
  deleteMessage: vi.fn(),
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

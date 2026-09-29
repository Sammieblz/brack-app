import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostComment } from "@/services/api";

const mocks = vi.hoisted(() => ({
  user: { id: "reader" }, read: vi.fn(), add: vi.fn(), remove: vi.fn(), subscribe: vi.fn(),
  success: vi.fn(), error: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
vi.mock("@/services/api", () => ({ fetchPostComments: mocks.read, addPostComment: mocks.add, deletePostComment: mocks.remove, subscribeToPostComments: mocks.subscribe }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { usePostComments } from "./usePostComments";
import { CommentThread } from "@/components/social/CommentThread";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const comment = (id: string, day: string, name = "Alex"): PostComment => ({
  id, post_id: "post", user_id: id, content: `Comment ${id}`, depth: 0, reply_count: 0,
  created_at: `2026-09-${day}T12:00:00.000000+00:00`, updated_at: `2026-09-${day}T12:00:00.000000+00:00`, user: { id, display_name: name },
});
const first = comment("first", "20");
const older = comment("older", "19", "Sam");
const fresh = comment("new", "21");
const page = (comments: PostComment[], next_cursor: string | null = null) => ({ comments, next_cursor, has_more: Boolean(next_cursor) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "reader" };
  mocks.subscribe.mockReturnValue(vi.fn());
  mocks.read.mockReset().mockResolvedValue(page([first]));
  mocks.add.mockReset().mockResolvedValue(first);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("comment request ownership", () => {
  it.each(["account", "post", "unmount"])("does not announce or refetch an obsolete %s write", async (change) => {
    const write = deferred<PostComment>();
    mocks.add.mockReturnValueOnce(write.promise);
    const view = renderHook(({ postId }) => usePostComments(postId), { initialProps: { postId: "post" } });
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    let posting!: Promise<boolean>;
    act(() => { posting = view.result.current.addComment("Old task"); });
    if (change === "unmount") view.unmount();
    else {
      if (change === "account") mocks.user = { id: "next-reader" };
      view.rerender({ postId: change === "post" ? "new-post" : "post" });
      await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    }
    const reads = mocks.read.mock.calls.length;
    await act(async () => { write.resolve(first); expect(await posting).toBe(true); });
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(reads);
  });

  it("pauses a hidden thread's completion refresh and refetches when the retained task becomes active", async () => {
    const write = deferred<PostComment>();
    mocks.add.mockReturnValueOnce(write.promise);
    const view = renderHook(({ active }) => usePostComments("post", undefined, active), { initialProps: { active: true } });
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    let posting!: Promise<boolean>;
    act(() => { posting = view.result.current.addComment("Retained hidden task"); });
    view.rerender({ active: false });
    await act(async () => { write.resolve(first); expect(await posting).toBe(true); });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(view.result.current.comments).toEqual([first]);
    view.rerender({ active: true });
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
  });

  it("keeps a confirmed write successful when the independent refresh fails", async () => {
    const view = renderHook(() => usePostComments("post"));
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    mocks.read.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }));
    await act(async () => { expect(await view.result.current.addComment("Committed once")).toBe(true); });
    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(view.result.current.error).toBeTruthy();
    expect(view.result.current.comments).toEqual([first]);
  });
});

describe("refreshing the already loaded comment range", () => {
  it("keeps a page-two reply owner and its newer draft while fresh first-page items shift pagination", async () => {
    mocks.read.mockResolvedValueOnce(page([first], "page-two")).mockResolvedValueOnce(page([older]));
    const write = deferred<PostComment>();
    mocks.add.mockReturnValueOnce(write.promise);
    render(<CommentThread postId="post" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more comments" }));
    const olderText = await screen.findByText("Comment older");
    const olderNode = olderText.closest(".rounded-md") as HTMLElement;
    fireEvent.click(within(olderNode).getByRole("button", { name: "Reply" }));
    const editor = screen.getByRole("textbox", { name: "Reply to Sam" });
    fireEvent.change(editor, { target: { value: "Submitted reply" } });
    fireEvent.click(within(olderNode).getAllByRole("button", { name: "Reply" })[1]);
    fireEvent.change(editor, { target: { value: "Newer reply draft" } });
    mocks.read.mockResolvedValueOnce(page([fresh], "fresh-two"))
      .mockResolvedValueOnce(page([first], "fresh-three"))
      .mockResolvedValueOnce(page([{ ...older, content: "Refreshed older parent" }], "unseen-four"));
    const refresh = mocks.subscribe.mock.calls.find(([postId]) => postId === "post")![1] as () => void;
    act(() => { refresh(); });
    await screen.findByText("Refreshed older parent");
    expect(screen.getByRole("textbox", { name: "Reply to Sam" })).toBe(editor);
    expect(editor).toHaveValue("Newer reply draft");
    expect(mocks.read).toHaveBeenCalledTimes(5);
    expect(mocks.read).toHaveBeenLastCalledWith("post", undefined, "fresh-three");
    await act(async () => write.reject(new Error("Write unavailable")));
    expect(editor).toHaveValue("Newer reply draft");
    expect(editor).toHaveAccessibleDescription(/Reply could not be posted/);
    expect(screen.getByRole("button", { name: "Load more comments" })).toBeEnabled();
  });

  it("commits fresh records atomically and retains the old range when a later page fails transiently", async () => {
    mocks.read.mockResolvedValueOnce(page([first], "page-two")).mockResolvedValueOnce(page([older]));
    const view = renderHook(() => usePostComments("post"));
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    act(() => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.comments).toHaveLength(2));
    mocks.read.mockResolvedValueOnce(page([fresh], "fresh-two"))
      .mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }));
    await act(async () => { await view.result.current.refetchComments(); });
    expect(view.result.current.comments).toEqual([first, older]);
    expect(view.result.current.hasLoaded).toBe(true);
    expect(view.result.current.error).toBeTruthy();
  });

  it("clears the entire retained range when a later refresh page denies access", async () => {
    mocks.read.mockResolvedValueOnce(page([first], "page-two")).mockResolvedValueOnce(page([older]));
    const view = renderHook(() => usePostComments("post"));
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    act(() => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.comments).toHaveLength(2));
    mocks.read.mockResolvedValueOnce(page([fresh], "fresh-two"))
      .mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    await act(async () => { await view.result.current.refetchComments(); });
    expect(view.result.current.comments).toEqual([]);
    expect(view.result.current.hasLoaded).toBe(false);
    expect(view.result.current.error).toBeTruthy();
  });

  it("ignores an obsolete multi-page refresh after a reader change", async () => {
    mocks.read.mockResolvedValueOnce(page([first], "page-two")).mockResolvedValueOnce(page([older]));
    const view = renderHook(() => usePostComments("post"));
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    act(() => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.comments).toHaveLength(2));
    const laterPage = deferred<ReturnType<typeof page>>();
    mocks.read.mockResolvedValueOnce(page([fresh], "fresh-two")).mockReturnValueOnce(laterPage.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = view.result.current.refetchComments(); });
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(4));
    mocks.read.mockResolvedValueOnce(page([]));
    mocks.user = { id: "another-reader" };
    view.rerender();
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    await act(async () => { laterPage.resolve(page([first, older])); await refresh; });
    expect(view.result.current.comments).toEqual([]);
  });
});

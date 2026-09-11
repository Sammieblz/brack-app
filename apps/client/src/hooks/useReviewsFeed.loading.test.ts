import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewsFeed } from "./useReviewsFeed";

const mocks = vi.hoisted(() => ({ feed: vi.fn(), user: { id: "reader" } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/services/api", () => ({ getReviewsFeed: mocks.feed, deleteBookReview: vi.fn(), shareReview: vi.fn(), toggleBookReviewLike: vi.fn() }));
const empty = { items: [], summary: { rating_mix: [], trending_books: [], review_opportunities: [] }, next_cursor: null, has_more: false, caught_up: true };
const options = { query: "", rating: "all", scope: "for_you", sort: "personalized" } as const;
beforeEach(() => { vi.clearAllMocks(); });

describe("review feed loading", () => {
  it("retains a successful empty feed during refresh and exposes failure separately", async () => {
    mocks.feed.mockResolvedValueOnce(empty);
    const { result } = renderHook(() => useReviewsFeed(options));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let finish!: (data: typeof empty) => void;
    mocks.feed.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => { finish(empty); await refresh; });
    mocks.feed.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toContain("could not load");
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.reviews).toEqual([]);
  });

  it("does not let an old filter request overwrite newer results", async () => {
    let finish!: (data: typeof empty) => void;
    mocks.feed.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(empty);
    const { result, rerender } = renderHook(({ query }) => useReviewsFeed({ ...options, query }), { initialProps: { query: "old" } });
    rerender({ query: "new" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { finish({ ...empty, items: [{ id: "stale" }] as never[] }); });
    expect(result.current.reviews).toEqual([]);
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ query: "new", limit: 20 }));
  });

  it("ignores a captured old refetch without cancelling the current filter request", async () => {
    mocks.feed.mockResolvedValueOnce(empty);
    const { result, rerender } = renderHook(({ query }) => useReviewsFeed({ ...options, query }), { initialProps: { query: "old" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const staleRefetch = result.current.refetch;
    let finish!: (data: typeof empty) => void;
    mocks.feed.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    rerender({ query: "new" });
    await act(async () => { await staleRefetch(); });
    expect(mocks.feed).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    await act(async () => { finish(empty); });
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(true);
  });

  it("retries a failed next page without replacing previously loaded reviews", async () => {
    mocks.feed.mockResolvedValueOnce({ ...empty, items: [{ id: "first" }], next_cursor: "page-2", has_more: true });
    const { result } = renderHook(() => useReviewsFeed(options));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.feed.mockRejectedValueOnce(new Error("offline"));
    act(() => { result.current.loadMore(); });
    await waitFor(() => expect(result.current.error).toContain("could not load"));
    expect(result.current.reviews.map((review) => review.id)).toEqual(["first"]);
    mocks.feed.mockResolvedValueOnce({ ...empty, items: [{ id: "second" }] });
    await act(async () => { await result.current.retry(); });
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "page-2" }));
    expect(result.current.reviews.map((review) => review.id)).toEqual(["first", "second"]);
  });
});

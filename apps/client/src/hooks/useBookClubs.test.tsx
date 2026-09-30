import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "reader-a" } as { id: string } | null,
  authLoading: false,
  create: vi.fn(),
  read: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
vi.mock("@/services/api", () => ({
  createBookClub: mocks.create, getClubsHome: mocks.read,
  deleteBookClub: vi.fn(), inviteClubMember: vi.fn(), joinBookClub: vi.fn(), leaveBookClub: vi.fn(),
  requestJoinClub: vi.fn(), respondClubInvite: vi.fn(), reviewJoinRequest: vi.fn(), updateBookClub: vi.fn(),
}));
import { useBookClubs } from "./useBookClubs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const home = {
  myClubs: [], suggested: [], nearby: [], popular: [], newest: [], invites: [], pendingRequests: [], searchResults: [],
  summary: { my_clubs: 0, suggested: 0, nearby: 0, invites: 0, pending_requests: 0 },
};

describe("club creation outcome ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "reader-a" };
    mocks.authLoading = false;
    mocks.read.mockResolvedValue(home);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("returns confirmed creation before list refresh settles and keeps its later failure separate", async () => {
    const { result } = renderHook(() => useBookClubs());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pendingRead = deferred<typeof home>();
    mocks.read.mockReturnValueOnce(pendingRead.promise);
    const created = { id: "new-club", name: "Reading together" };
    mocks.create.mockResolvedValueOnce(created);
    await act(async () => { expect(await result.current.createClub({ name: created.name })).toBe(created); });
    expect(result.current.refreshing).toBe(true);
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith("Book club created");
    await act(async () => { pendingRead.reject(new Error("List temporarily unavailable")); });
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.error?.message).toBe("List temporarily unavailable");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejected creation without refreshing or reporting success", async () => {
    const { result } = renderHook(() => useBookClubs());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const error = new Error("Creation refused");
    mocks.create.mockRejectedValueOnce(error);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { await expect(result.current.createClub({ name: "Reading together" })).rejects.toBe(error); });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("refreshes the current filter when a delayed search settles during creation", async () => {
    const { result, rerender } = renderHook(({ searchQuery }) => useBookClubs({ searchQuery }), {
      initialProps: { searchQuery: "old" },
    });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<{ id: string }>();
    mocks.create.mockReturnValueOnce(pending.promise);
    let request!: Promise<unknown>;
    act(() => { request = result.current.createClub({ name: "New reading club" }); });
    rerender({ searchQuery: "current" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(mocks.read).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve({ id: "new-club" }); await request; });
    expect(mocks.read).toHaveBeenCalledTimes(3);
    expect(mocks.read).toHaveBeenLastCalledWith({ searchQuery: "current" });
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it.each(["account", "loading", "unmount", "account-roundtrip"] as const)(
    "suppresses late confirmed-create feedback and refresh after %s", async (change) => {
      const { result, rerender, unmount } = renderHook(() => useBookClubs());
      await waitFor(() => expect(result.current.hasLoaded).toBe(true));
      const pending = deferred<{ id: string }>();
      mocks.create.mockReturnValueOnce(pending.promise);
      let request!: Promise<unknown>;
      act(() => { request = result.current.createClub({ name: "Original reader's club" }); });
      if (change === "unmount") unmount();
      else if (change === "loading") { mocks.authLoading = true; rerender(); }
      else {
        mocks.user = { id: "reader-b" }; rerender();
        if (change === "account-roundtrip") { mocks.user = { id: "reader-a" }; rerender(); }
      }
      const reads = mocks.read.mock.calls.length;
      const created = { id: "committed-club" };
      await act(async () => { pending.resolve(created); expect(await request).toBe(created); });
      expect(mocks.success).not.toHaveBeenCalled();
      expect(mocks.error).not.toHaveBeenCalled();
      expect(mocks.read).toHaveBeenCalledTimes(reads);
    },
  );

  it("propagates a late rejection without announcing it in a replacement reader", async () => {
    const { result, rerender } = renderHook(() => useBookClubs());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const pending = deferred<never>();
    mocks.create.mockReturnValueOnce(pending.promise);
    let request!: Promise<unknown>;
    act(() => { request = result.current.createClub({ name: "Old task" }); });
    mocks.user = { id: "reader-b" }; rerender();
    const reads = mocks.read.mock.calls.length;
    const failure = new Error("Late rejection");
    await act(async () => { pending.reject(failure); await expect(request).rejects.toBe(failure); });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(reads);
  });

  it.each(["account", "account-roundtrip"])("rejects a captured callback after %s before creating anything", async (change) => {
    const { result, rerender } = renderHook(() => useBookClubs());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const obsolete = result.current.createClub;
    mocks.user = { id: "reader-b" }; rerender();
    if (change === "account-roundtrip") { mocks.user = { id: "reader-a" }; rerender(); }
    await act(async () => { await expect(obsolete({ name: "Obsolete draft" })).rejects.toThrow("Your session changed"); });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserSearch } from "./useUserSearch";
import { useBookClubs } from "./useBookClubs";

const state = vi.hoisted(() => ({ user: { id: "reader-a" } as { id: string } | null, readers: vi.fn(), clubs: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/services/api", () => ({
  discoverReaders: state.readers, getClubsHome: state.clubs,
  createBookClub: vi.fn(), deleteBookClub: vi.fn(), inviteClubMember: vi.fn(), joinBookClub: vi.fn(),
  leaveBookClub: vi.fn(), requestJoinClub: vi.fn(), respondClubInvite: vi.fn(), reviewJoinRequest: vi.fn(), updateBookClub: vi.fn(),
}));
const emptyReaders = { suggestions: [], nearby: [], connections: [], friendsOfFriends: [], activeFriends: [], searchResults: [] };
const emptyClubs = { myClubs: [], suggested: [], nearby: [], popular: [], newest: [], invites: [], pendingRequests: [], searchResults: [], summary: { my_clubs: 0, suggested: 0, nearby: 0, invites: 0, pending_requests: 0 } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }

beforeEach(() => { vi.clearAllMocks(); state.user = { id: "reader-a" }; });

describe("discovery loading contracts", () => {
  it("treats an empty successful reader result as retained content during an awaited refresh", async () => {
    state.readers.mockResolvedValueOnce(emptyReaders);
    const { result } = renderHook(() => useUserSearch("poetry"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const pending = deferred<typeof emptyReaders>();
    state.readers.mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.results.searchResults).toEqual([]);
    await act(async () => { pending.resolve(emptyReaders); await refresh; });
    expect(result.current.refreshing).toBe(false);
    expect(state.readers).toHaveBeenLastCalledWith("poetry", 50);
  });

  it("masks prior query/account results and ignores superseded responses", async () => {
    const first = deferred<typeof emptyReaders>();
    const second = deferred<typeof emptyReaders>();
    state.readers.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ query }) => useUserSearch(query), { initialProps: { query: "first" } });
    rerender({ query: "second" });
    await act(async () => { second.resolve(emptyReaders); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { first.resolve({ ...emptyReaders, searchResults: [{ id: "stale" }] as never[] }); });
    expect(result.current.results.searchResults).toEqual([]);
    state.user = null;
    rerender({ query: "second" });
    expect(result.current.results).toEqual(emptyReaders);
    expect(result.current.refreshing).toBe(false);
  });

  it("shows discovery failure as an error, then clears it on retry", async () => {
    state.readers.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(emptyReaders);
    const { result } = renderHook(() => useUserSearch());
    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
  });

  it("retains club home data on failed refresh instead of silently substituting an empty fallback", async () => {
    const home = { ...emptyClubs, myClubs: [{ id: "club-a" }] };
    state.clubs.mockResolvedValueOnce(home).mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = renderHook(() => useBookClubs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.fetchClubs(); });
    expect(result.current.home.myClubs).toEqual(home.myClubs);
    expect(result.current.clubs).toEqual(home.myClubs);
    expect(result.current.error?.message).toBe("offline");
    state.user = { id: "reader-b" };
    state.clubs.mockReturnValueOnce(new Promise(() => {}));
    rerender();
    expect(result.current.clubs).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});

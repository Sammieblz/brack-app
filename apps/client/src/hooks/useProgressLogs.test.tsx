import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressRepo, syncRepo } from "@/services/local";
import type { ProgressLog } from "@/services/api";
import { useProgressLogs } from "./useProgressLogs";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "reader" } as { id: string } | null, loading: false },
  online: true,
  fetch: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/services/api", () => ({ fetchProgressLogs: mocks.fetch }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: () => mocks.online }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const log = (overrides: Partial<ProgressLog> = {}): ProgressLog => ({
  id: crypto.randomUUID(), user_id: mocks.auth.user!.id, book_id: "book",
  page_number: 42, log_type: "manual", notes: "Saved on this device",
  logged_at: "2026-10-01T12:00:00.000Z", created_at: "2026-10-01T12:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  mocks.auth = { user: { id: crypto.randomUUID() }, loading: false };
  mocks.online = true;
  mocks.fetch.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe("progress history local capture continuity", () => {
  it("keeps a pending log and its outbox when older remote content is hydrated", async () => {
    const saved = log();
    await progressRepo.createPending(saved.user_id, saved);
    const remote = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(remote.promise);
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.logs).toMatchObject([saved]));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => remote.resolve([{ ...saved, notes: "Old remote words", page_number: 12 }]));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.logs).toMatchObject([saved]);
    expect((await progressRepo.listRecords(saved.user_id))[0]).toMatchObject({ status: "pending", data: saved });
    expect(await syncRepo.listPending(saved.user_id)).toEqual([expect.objectContaining({ client_entity_id: saved.id, entity: "progress_logs" })]);
  });

  it("includes a capture saved and acknowledged while an older empty response was pending", async () => {
    const remote = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(remote.promise);
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    const saved = log();
    await progressRepo.createPending(saved.user_id, saved);
    await progressRepo.upsertRemote(saved.user_id, saved);
    await act(async () => remote.resolve([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logs).toEqual([saved]);
  });

  it("does not resurrect a local tombstone committed while the remote request waited", async () => {
    const saved = log();
    await progressRepo.upsertRemote(saved.user_id, saved);
    const remote = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(remote.promise);
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.logs).toEqual([saved]));
    await progressRepo.softDeleteLocal(saved.user_id, saved);
    await act(async () => remote.resolve([saved]));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.logs).toEqual([]);
    expect((await progressRepo.listRecords(saved.user_id, { includeDeleted: true }))[0].status).toBe("deleted");
  });

  it("shows newest local logs offline without fetching or showing other books", async () => {
    mocks.online = false;
    const older = log({ logged_at: "2026-09-30T12:00:00.000Z" });
    const newer = log();
    await progressRepo.createPending(older.user_id, older);
    await progressRepo.createPending(newer.user_id, newer);
    await progressRepo.createPending(newer.user_id, log({ book_id: "another-book" }));
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.logs).toMatchObject([newer, older]);
    expect(result.current.loading).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retains cached content on refresh failure and clears the error after retry", async () => {
    const saved = log();
    await progressRepo.createPending(saved.user_id, saved);
    mocks.fetch.mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.logs).toMatchObject([saved]);
    expect(result.current.loading).toBe(false);
    await act(async () => result.current.refetchLogs());
    expect(result.current.logs).toMatchObject([saved]);
    expect(result.current.error).toBeNull();
  });

  it.each([401, 403, 404])("hides cached history when access is rejected with %s", async status => {
    const saved = log();
    await progressRepo.upsertRemote(saved.user_id, saved);
    mocks.fetch.mockRejectedValueOnce({ status });
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("masks an old account immediately and does not hydrate its late response", async () => {
    const saved = log();
    await progressRepo.upsertRemote(saved.user_id, saved);
    const first = deferred<ProgressLog[]>();
    const second = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(result.current.logs).toEqual([saved]));
    const oldRefetch = result.current.refetchLogs;
    mocks.auth = { user: { id: crypto.randomUUID() }, loading: false };
    rerender();
    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    const stale = log({ user_id: saved.user_id });
    await act(async () => first.resolve([stale]));
    await act(async () => oldRefetch());
    expect(await progressRepo.get(stale.id)).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const next = log();
    await act(async () => second.resolve([next]));
    await waitFor(() => expect(result.current.logs).toEqual([next]));
  });

  it("rejects A-to-B-to-A stale reads and old route refresh callbacks", async () => {
    const old = deferred<ProgressLog[]>();
    const current = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]).mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(({ book }) => useProgressLogs(book), { initialProps: { book: "book" } });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const oldSameBookRefetch = result.current.refetchLogs;
    rerender({ book: "other" });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    const staleRefetch = result.current.refetchLogs;
    rerender({ book: "book" });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
    const stale = log();
    await act(async () => old.resolve([stale]));
    await act(async () => staleRefetch());
    await act(async () => oldSameBookRefetch());
    expect(await progressRepo.get(stale.id)).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    const fresh = log();
    await act(async () => current.resolve([fresh]));
    await waitFor(() => expect(result.current.logs).toEqual([fresh]));
  });

  it("ignores an older same-book refresh and rejects mismatched remote owners/books", async () => {
    const old = deferred<ProgressLog[]>();
    const current = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    act(() => { void result.current.refetchLogs(); });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    const fresh = log();
    const alien = log({ user_id: "other-reader" });
    const otherBook = log({ book_id: "other-book" });
    await act(async () => current.resolve([fresh, alien, otherBook]));
    await waitFor(() => expect(result.current.logs).toEqual([fresh]));
    await act(async () => old.resolve([{ ...fresh, page_number: 1 }]));
    expect(result.current.logs).toEqual([fresh]);
    expect(await progressRepo.get(alien.id)).toBeNull();
    expect(await progressRepo.get(otherBook.id)).toBeNull();
    expect(await progressRepo.get(fresh.id)).toMatchObject({ page_number: 42 });
  });

  it("masks auth loading and does not start captured callbacks after unmount", async () => {
    const remote = deferred<ProgressLog[]>();
    mocks.fetch.mockReturnValueOnce(remote.promise);
    const { result, rerender, unmount } = renderHook(() => useProgressLogs("book"));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    const oldRefetch = result.current.refetchLogs;
    mocks.auth = { ...mocks.auth, loading: true };
    rerender();
    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(false);
    unmount();
    const stale = log();
    await act(async () => remote.resolve([stale]));
    await act(async () => oldRefetch());
    expect(await progressRepo.get(stale.id)).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});

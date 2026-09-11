import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRetainedReaderResource } from "./useRetainedReaderResource";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

afterEach(cleanup);

describe("retained reader resource loading contract", () => {
  it("preserves successful empty results during refresh and transient failure", async () => {
    const initial = deferred<string[]>();
    const refresh = deferred<string[]>();
    const read = vi
      .fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(() =>
      useRetainedReaderResource("reader", read),
    );
    expect(result.current.loading).toBe(true);
    await act(async () => initial.resolve([]));
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    act(() => {
      void result.current.refetch();
    });
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => refresh.reject({ status: 503 }));
    expect(result.current.data).toEqual([]);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it.each([401, 403, 404])(
    "drops revoked data after status %s",
    async (status) => {
      const read = vi
        .fn()
        .mockResolvedValueOnce(["private"])
        .mockRejectedValueOnce({ status });
      const { result } = renderHook(() =>
        useRetainedReaderResource("reader", read),
      );
      await act(async () => undefined);
      expect(result.current.data).toEqual(["private"]);
      await act(async () => result.current.refetch());
      expect(result.current.data).toBeUndefined();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
    },
  );

  it("masks identity changes and rejects A to B to A stale completions", async () => {
    const requests = [
      deferred<string[]>(),
      deferred<string[]>(),
      deferred<string[]>(),
    ];
    const read = vi
      .fn()
      .mockReturnValueOnce(requests[0].promise)
      .mockReturnValueOnce(requests[1].promise)
      .mockReturnValueOnce(requests[2].promise);
    const { result, rerender } = renderHook(
      ({ id }) => useRetainedReaderResource(id, read),
      { initialProps: { id: "A" } },
    );
    rerender({ id: "B" });
    expect(result.current.data).toBeUndefined();
    rerender({ id: "A" });
    await act(async () => requests[0].resolve(["stale A"]));
    await act(async () => requests[1].resolve(["stale B"]));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await act(async () => requests[2].resolve(["current A"]));
    expect(result.current.data).toEqual(["current A"]);
  });

  it("does not leak resolved data into a new identity or after logout", async () => {
    const next = deferred<string[]>();
    const read = vi
      .fn()
      .mockResolvedValueOnce(["reader A"])
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(
      ({ id }: { id?: string }) => useRetainedReaderResource(id, read),
      { initialProps: { id: "A" } },
    );
    await act(async () => undefined);
    rerender({ id: "B" });
    expect(result.current.data).toBeUndefined();
    rerender({ id: undefined });
    await act(async () => next.resolve(["reader B"]));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it("ignores an old refetch callback without cancelling the new resource's pending read", async () => {
    const next = deferred<string[]>();
    const read = vi.fn().mockResolvedValueOnce(["A"]).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ id }) => useRetainedReaderResource(id, read), { initialProps: { id: "A" } });
    await act(async () => undefined);
    const staleRefetch = result.current.refetch;
    rerender({ id: "B" });
    expect(result.current.loading).toBe(true);
    await act(async () => staleRefetch());
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await act(async () => next.resolve(["B"]));
    expect(result.current.data).toEqual(["B"]);
    expect(result.current.loading).toBe(false);
  });

  it("waits for enablement and supports an explicit retry after initial failure", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ enabled }) => useRetainedReaderResource("reader", read, enabled),
      { initialProps: { enabled: false } },
    );
    expect(read).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    rerender({ enabled: true });
    await act(async () => undefined);
    expect(result.current.error?.message).toBe("offline");
    await act(async () => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });

  it("ignores requests that complete after unmount", async () => {
    const request = deferred<string[]>();
    const read = () => request.promise;
    const { result, unmount } = renderHook(() =>
      useRetainedReaderResource("reader", read),
    );
    const snapshot = result.current;
    unmount();
    await act(async () => request.resolve(["late"]));
    expect(result.current).toBe(snapshot);
  });

  it("does not start a captured refresh after unmount", async () => {
    const read = vi.fn().mockResolvedValue(["A"]);
    const { result, unmount } = renderHook(() => useRetainedReaderResource("A", read));
    await act(async () => undefined);
    const staleRefetch = result.current.refetch;
    unmount();
    await act(async () => staleRefetch());
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("treats undefined as absent rather than a retained successful collection", async () => {
    const read = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRetainedReaderResource("reader", read),
    );
    await act(async () => undefined);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
